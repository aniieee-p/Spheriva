export const isValidEmail = (value) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  
  // Indian mobile number: 10 digits, starts with 6-9
  export const isValidPhone = (value) =>
    /^[6-9]\d{9}$/.test(value.trim());
  
  export const validateEmailOrPhone = (value) => {
    if (!value.trim()) return 'Email or phone number is required';
    if (!isValidEmail(value) && !isValidPhone(value)) {
      return 'Enter a valid email or 10-digit phone number';
    }
    return '';
  };
  
  export const validatePassword = (value) => {
    if (!value) return 'Password is required';
    if (value.length < 6) return 'Password must be at least 6 characters';
    return '';
  };
  
  export const validateName = (value) => {
    if (!value.trim()) return 'Name is required';
    if (value.trim().length < 2) return 'Name must be at least 2 characters';
    return '';
  };
  
  export const validateConfirmPassword = (password, confirm) => {
    if (!confirm) return 'Please confirm your password';
    if (password !== confirm) return 'Passwords do not match';
    return '';
  };