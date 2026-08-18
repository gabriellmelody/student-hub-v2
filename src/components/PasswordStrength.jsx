import { getPasswordStrength } from "../utils/authUtils.js";

export default function PasswordStrength({ password }) {
  if (!password) return null;
  const strength = getPasswordStrength(password);
  return (
    <div className={`password-strength strength-${strength.level}`} aria-live="polite">
      <span className="password-strength-track" aria-hidden="true"><i /><i /><i /></span>
      <small>{strength.label}</small>
    </div>
  );
}
