import { type } from "arktype";

export const Password = type.string.narrow((s, ctx) => {
  if (s.length < 8) return ctx.reject("Must be at least 8 characters");
  if (!/[A-Z]/.test(s)) return ctx.reject("Must contain an uppercase letter");
  if (!/[a-z]/.test(s)) return ctx.reject("Must contain a lowercase letter");
  if (!/[0-9]/.test(s)) return ctx.reject("Must contain a number");
  if (!/[^A-Za-z0-9]/.test(s))
    return ctx.reject("Must contain a special character");
  return true;
});

export type PasswordType = typeof Password.infer;

export const RegisterUser = type({
  email: type.string,
  password: Password,
});

export type RegisterUserType = typeof RegisterUser.infer;

export const LoginUser = type({
  email: type.string,
  password: type.string,
});

export type LoginUserType = typeof LoginUser.infer;

export const ForgotPassword = type({
  email: type.string,
});

export type ForgotPasswordType = typeof ForgotPassword.infer;

export const ResetPassword = type({
  token: type.string,
  password: Password,
});

export type ResetPasswordType = typeof ResetPassword.infer;

export const VerifyEmail = type({
  token: type.string,
});

export type VerifyEmailType = typeof VerifyEmail.infer;
