import { useEffect, useRef, useState, useCallback } from "react";

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? '';
const API_BASE_PATH = import.meta.env.BASE_URL ?? '/';
const HTTP_METHODS = new Set(['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT']);

function buildUrl(path) {
   if (typeof path !== 'string' || /[\u0000-\u001F\u007F]/.test(path) || path.startsWith('//') || /^https?:\/\//i.test(path)) {
      throw new TypeError('Request path must be a relative URL without control characters');
   }

   const base = `${API_ORIGIN}${API_BASE_PATH}`.replace(/\/+$/, '');
   const suffix = path.startsWith('/') ? path : `/${path}`;
   return new URL(`${base}${suffix}`, window.location.origin).toString();
}

const EMPTY_HEADERS = {};

/**
 * useApiCall
 * Reusable hook for talking to the app's BE server (GET/POST/PATCH/...).
 *
 * @param {string} [path=''] - default additional url part (application path), e.g. "/ui/personalisation"
 * @param {object} [options]
 * @param {string} [options.method='GET'] - default HTTP method, overridable per-call via `call({ method })`
 * @param {Record<string, string>} [options.headers] - default headers, merged with per-call `call({ headers })`
 * @param {unknown} [options.payload] - default payload; for GET/HEAD it's sent as query params, otherwise as JSON body
 * @param {boolean} [options.auto=true] - fetch automatically on mount (and whenever `call` changes, see options above)
 * @param {'include'|'same-origin'|'omit'} [options.credentials='include'] - 'include' is required whenever the BE origin
 *   differs from the page origin (e.g. dev tunnels), since this app's session cookie is `sameSite: 'none'`
 * @param {number} [options.timeout=0] - abort the request after this many ms, 0 = no timeout
 * @returns {{ data: unknown, meta: { status: number, headers: Headers } | null, error: { message: string, status?: number, body?: unknown, aborted?: boolean } | null, loading: boolean, call: Function, abort: Function }}
 */

export function useApiCall(path = "", options = {}) {
   const {
      method: defaultMethod = "GET",
      headers: defaultHeaders = EMPTY_HEADERS,
      payload: defaultPayload = undefined,
      auto = true,
      credentials = "include",
      timeout = 0,
   } = options;

   if (!HTTP_METHODS.has(String(defaultMethod).toUpperCase())) {
      throw new TypeError(`Unsupported HTTP method: ${defaultMethod}`);
   }
   if (!Number.isFinite(timeout) || timeout < 0) {
      throw new TypeError('Timeout must be a non-negative number');
   }

   const [data, setData] = useState(null);
   const [meta, setMeta] = useState(null);
   const [error, setError] = useState(null);
   const [loading, setLoading] = useState(Boolean(auto));

   const controllerRef = useRef(null);
   const requestIdRef = useRef(0);

   const abort = useCallback(() => {
      controllerRef.current?.abort();
   }, []);

   const call = useCallback(
      async (pathOrOverrides = {}, maybeOverrides = {}) => {
         controllerRef.current?.abort();
         const controller = new AbortController();
         controllerRef.current = controller;
         const requestId = ++requestIdRef.current;

         const hasPathArg = typeof pathOrOverrides === "string";
         const overrides = hasPathArg ? maybeOverrides : pathOrOverrides;
         const runtimePath = hasPathArg ? pathOrOverrides : path;

         const finalMethod = String(overrides.method ?? defaultMethod).toUpperCase();
         if (!HTTP_METHODS.has(finalMethod)) {
            throw new TypeError(`Unsupported HTTP method: ${finalMethod}`);
         }
         const finalPayload = overrides.payload !== undefined ? overrides.payload : defaultPayload;
         const finalHeaders = {
            ...defaultHeaders,
            ...(overrides.headers || {}),
         };

         if (Object.entries(finalHeaders).some(([header, value]) =>
            !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(header) ||
            typeof value !== 'string' || /[\u0000-\u001F\u007F]/.test(value)
         )) {
            throw new TypeError('Request headers contain an invalid name');
         }

         // build URL and handle GET query params
         let url = buildUrl(runtimePath);
         if ((finalMethod === "GET" || finalMethod === "HEAD") && finalPayload && typeof finalPayload === "object") {
            const params = new URLSearchParams(finalPayload).toString();
            url += params ? (url.includes("?") ? "&" : "?") + params : "";
         }

         let body;
         if (finalPayload !== undefined && finalMethod !== "GET" && finalMethod !== "HEAD") {
            if (!finalHeaders["Content-Type"]) finalHeaders["Content-Type"] = "application/json";
            if (finalHeaders["Content-Type"].includes("application/json")) {
               body = JSON.stringify(finalPayload);
            } else {
               body = finalPayload;
            }
         }

         setLoading(true);
         setError(null);

         let timeoutId;
         if (timeout > 0) {
            timeoutId = setTimeout(() => controller.abort(), timeout);
         }

         try {
            const res = await fetch(url, {
               method: finalMethod,
               headers: finalHeaders,
               body,
               credentials,
               cache: 'no-store',
               signal: controller.signal,
            });

            const contentType = res.headers.get("content-type") || "";
            const result = contentType.includes("application/json") ? await res.json() : await res.text();

            if (!res.ok) {
               const httpError = { message: `HTTP ${res.status}`, status: res.status, body: result };
               setError(httpError);
               setMeta({ status: res.status, headers: res.headers });
               throw httpError;
            }

            if (requestId === requestIdRef.current) {
               setData(result);
               setMeta({ status: res.status, headers: res.headers });
            }
            return { data: result, meta: { status: res.status, headers: res.headers } };

         } catch (err) {
            if (err && (err.status !== undefined || err.aborted)) {
               throw err;
            }

            if (err && err.name === "AbortError") {
               const abortErr = { message: "Request aborted", aborted: true };
               setError(abortErr);
               throw abortErr;
            }

            const normalized = { message: err && err.message ? err.message : String(err) };
            setError(normalized);
            throw normalized;
         } finally {
            if (timeoutId) clearTimeout(timeoutId);
            if (requestId === requestIdRef.current) setLoading(false);
         }
      },

      [path, defaultMethod, defaultPayload, defaultHeaders, credentials, timeout]
   );

   useEffect(() => {
      if (!auto) return;
      // intentional: fetch on mount / whenever `call` changes
      // eslint-disable-next-line react-hooks/set-state-in-effect
      call().catch(() => { });
      return () => controllerRef.current?.abort();
   }, [auto, call]);

   return { data, meta, error, loading, call, abort };
};