export type NavbarUser = { email?: string | null } | null;

export type NavbarSession = {
  email: string | null;
  showSignIn: boolean;
  showSignUp: boolean;
  showLogOut: boolean;
  staff: boolean;
};

export function navbarSession(input: {
  authEnabled: boolean;
  user: NavbarUser;
  staff: boolean;
}): NavbarSession {
  if (!input.authEnabled || !input.user) {
    const signedOut = input.authEnabled && !input.user;
    return {
      email: null,
      showSignIn: signedOut,
      showSignUp: signedOut,
      showLogOut: false,
      staff: false,
    };
  }

  const email = typeof input.user.email === "string" ? input.user.email.trim() : "";
  return {
    email: email.length > 0 ? email : null,
    showSignIn: false,
    showSignUp: false,
    showLogOut: true,
    staff: input.staff,
  };
}
