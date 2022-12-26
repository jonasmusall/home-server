export const username = document.cookie.split(';').find(cookie => cookie.trim().startsWith('app_user='))?.substring(9);
