/**
 * Subdomain Detection Utility
 * Checks if the current request is coming from the Super Admin subdomain.
 */

export const isSuperAdminSubdomain = () => {
    const hostname = window.location.hostname;
    
    // Production check
    if (hostname.startsWith('super_admin.')) return true;
    if (hostname.startsWith('superadmin.')) return true;
    
    // Development check (localhost:8080)
    if (hostname === 'superadmin.localhost') return true;
    
    return false;
};
