module.exports = {
  apps: [
    {
      name: 'movieshop',
      script: 'node_modules/next/dist/bin/next',
      // Bind explicitly to the IPv4 interface.
      //
      // Next's default listener shows up as `::` (IPv6 any). Whether that also
      // accepts IPv4 depends on the socket's IPV6_V6ONLY flag, and when it is
      // set the phone's IPv4 connection is refused even though the server looks
      // bound to "everything". Naming 0.0.0.0 removes the ambiguity entirely.
      args: 'dev --hostname 0.0.0.0',
      cwd: 'C:\\Users\\5dm\\movieshop-new',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PATH: `C:\\Users\\5dm\\AppData\\Roaming\\Python\\Python314\\Scripts;${process.env.PATH}`,
      },
    },
  ],
};
