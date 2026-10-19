import { API_URL } from "../constants/config";
import { getToken } from "../utils/storage";

type ApiOptions = RequestInit & {
  authenticated?: boolean;
};

export async function apiRequest(
  endpoint: string,
  options: ApiOptions = {}
) {
  const { authenticated = true, headers, ...fetchOptions } = options;

  const requestHeaders = new Headers(headers);

  requestHeaders.set("Content-Type", "application/json");

  if (authenticated) {
    const token = await getToken();

    if (token) {
      requestHeaders.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers: requestHeaders,
  });

  let data: any = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.detail ||
      data?.message ||
      `Request failed with status ${response.status}`;

    throw new Error(message);
  }

  return data;
}

export async function apiGet(
  endpoint: string,
  authenticated = true
) {
  return apiRequest(endpoint, {
    method: "GET",
    authenticated,
  });
}

export async function apiPost(
  endpoint: string,
  body?: unknown,
  authenticated = true
) {
  return apiRequest(endpoint, {
    method: "POST",
    authenticated,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiPut(
  endpoint: string,
  body?: unknown,
  authenticated = true
) {
  return apiRequest(endpoint, {
    method: "PUT",
    authenticated,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiPatch(
  endpoint: string,
  body?: unknown,
  authenticated = true
) {
  return apiRequest(endpoint, {
    method: "PATCH",
    authenticated,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function apiDelete(
  endpoint: string,
  authenticated = true
) {
  return apiRequest(endpoint, {
    method: "DELETE",
    authenticated,
  });
}