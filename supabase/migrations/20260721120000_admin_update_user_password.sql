-- RPC function allowing Admins & Super Admins to update passwords for any employee
CREATE OR REPLACE FUNCTION public.admin_update_user_password(_user_id UUID, _new_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  -- Verify caller is admin or super_admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can update user passwords.';
  END IF;

  IF length(_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters long.';
  END IF;

  -- Update encrypted password in auth.users
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = _user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User record not found.';
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Password updated successfully');
END;
$$;

-- Alias for backward & alternate client compatibility
CREATE OR REPLACE FUNCTION public.change_user_password(target_user_id UUID, new_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  RETURN public.admin_update_user_password(target_user_id, new_password);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_user_password(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_user_password(UUID, TEXT) TO authenticated;
