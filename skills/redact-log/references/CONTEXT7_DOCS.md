# Documentation cache

## Python 3.13

### Query: ipaddress public IPv4/IPv6 classification

Queried: 2026-10-08 through Context7 /python/cpython/v3.13.9.

- ipaddress.ip_address() validates IPv4 and IPv6, including compressed IPv6 and scope IDs.
- Shared address space 100.64.0.0/10 has both is_global and is_private false.
- Do not use not is_private alone to classify public addresses.
- Exclude multicast and deprecated IPv6 site-local even where is_global is true.
- Classify IPv4-mapped IPv6 by the embedded IPv4 address.

Sources: https://github.com/python/cpython/blob/v3.13.9/Doc/library/ipaddress.rst and https://github.com/python/cpython/blob/main/Lib/ipaddress.py.
