BEGIN;

CREATE OR REPLACE FUNCTION register_staff_user(p_name text,p_email text,p_hash text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=smartvault,pg_temp AS $$
DECLARE result_id integer;
BEGIN
 IF length(btrim(p_name)) < 2 THEN RAISE EXCEPTION 'Enter a name with at least 2 characters'; END IF;
 IF p_hash NOT LIKE 'scrypt$%' THEN RAISE EXCEPTION 'A scrypt password hash is required'; END IF;
 INSERT INTO app_users(full_name,email,role,password_hash)
 VALUES(btrim(p_name),lower(btrim(p_email)),'STAFF',p_hash)
 RETURNING user_id INTO result_id;
 RETURN result_id;
END $$;

REVOKE EXECUTE ON FUNCTION register_staff_user(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_staff_user(text,text,text) TO smartvault_auth;

COMMIT;
