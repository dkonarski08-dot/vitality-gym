-- migrations/005b_nullify_pin_codes.sql
-- Run ONLY after seed-app-users.ts has been confirmed to work.
-- Removes plaintext PINs from employees table (no longer used for login).
UPDATE employees SET pin_code = NULL;
