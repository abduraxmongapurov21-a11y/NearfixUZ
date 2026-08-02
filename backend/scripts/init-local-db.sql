DO
$$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'nearfix') THEN
    CREATE ROLE nearfix LOGIN PASSWORD 'nearfix';
  ELSE
    ALTER ROLE nearfix WITH LOGIN PASSWORD 'nearfix';
  END IF;
END
$$;

SELECT 'CREATE DATABASE nearfix OWNER nearfix'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nearfix')\gexec

GRANT ALL PRIVILEGES ON DATABASE nearfix TO nearfix;
