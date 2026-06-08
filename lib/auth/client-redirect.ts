export function redirectToLoginOnUnauthorized(response: Response) {
  if (response.status !== 401) {
    return false;
  }

  if (typeof window !== "undefined") {
    window.location.assign("/login");
  }

  return true;
}
