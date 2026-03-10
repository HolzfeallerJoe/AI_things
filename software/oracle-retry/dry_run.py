"""
Dry run: connects to Oracle, discovers all resources, shows what would happen.
Does NOT create any instance.

Usage:
  pip install oci requests
  python dry_run.py
"""

import oci
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(SCRIPT_DIR, "oci-config", "config")
KEY_PATH = os.path.join(SCRIPT_DIR, "oci-config", "key.pem")
SSH_KEY_PATH = os.path.join(SCRIPT_DIR, "oci-config", "ssh_key.pub")

INSTANCE_NAME = "pangolin-headscale"
OCPUS = 1
MEMORY_GB = 6


def check(label, ok, detail=""):
    status = "OK" if ok else "FAIL"
    print(f"  [{status}] {label}")
    if detail:
        print(f"         {detail}")
    return ok


def main():
    print("=" * 60)
    print("  ORACLE INSTANCE RETRY - DRY RUN")
    print("=" * 60)
    print()

    # --- Check local files ---
    print("1. Checking local files...")
    all_ok = True
    all_ok &= check("OCI config file", os.path.exists(CONFIG_PATH), CONFIG_PATH)
    all_ok &= check("API private key (key.pem)", os.path.exists(KEY_PATH), KEY_PATH)
    all_ok &= check("SSH public key (ssh_key.pub)", os.path.exists(SSH_KEY_PATH), SSH_KEY_PATH)

    if not all_ok:
        print("\n  Missing files. Place them in the oci-config/ folder.")
        sys.exit(1)

    # --- Fix key_file path for local run ---
    print()
    print("2. Loading OCI config...")

    # Read config manually and override key_file to local path
    # (can't use from_file because it validates the Docker path before we can fix it)
    import configparser
    parser = configparser.ConfigParser()
    parser.read(CONFIG_PATH)
    profile = "DEFAULT"
    config = {
        "user": parser.get(profile, "user"),
        "fingerprint": parser.get(profile, "fingerprint"),
        "tenancy": parser.get(profile, "tenancy"),
        "region": parser.get(profile, "region"),
        "key_file": KEY_PATH,
    }

    try:
        oci.config.validate_config(config)
        check("Config is valid", True)
    except Exception as e:
        check("Config validation", False, str(e))
        sys.exit(1)

    print(f"         user:        {config['user'][:40]}...")
    print(f"         tenancy:     {config['tenancy'][:40]}...")
    print(f"         region:      {config['region']}")
    print(f"         fingerprint: {config['fingerprint']}")

    # --- Connect to Oracle ---
    print()
    print("3. Connecting to Oracle Cloud...")

    try:
        identity = oci.identity.IdentityClient(config)
        tenancy = identity.get_tenancy(config["tenancy"]).data
        check("Connected to Oracle Cloud", True, f"Tenancy: {tenancy.name}")
    except Exception as e:
        check("Connection to Oracle Cloud", False, str(e))
        sys.exit(1)

    # --- Discover availability domains ---
    print()
    print("4. Discovering availability domains...")

    compartment_id = config["tenancy"]
    ads = identity.list_availability_domains(compartment_id).data
    check(f"Found {len(ads)} availability domains", len(ads) > 0)
    for ad in ads:
        print(f"         - {ad.name}")

    # --- Discover networking ---
    print()
    print("5. Discovering networks and subnets...")

    network = oci.core.VirtualNetworkClient(config)
    vcns = network.list_vcns(compartment_id).data
    check(f"Found {len(vcns)} VCN(s)", len(vcns) > 0)

    subnet_id = None
    for vcn in vcns:
        print(f"         VCN: {vcn.display_name}")
        subnets = network.list_subnets(compartment_id, vcn_id=vcn.id).data
        for subnet in subnets:
            is_public = not subnet.prohibit_public_ip_on_vnic
            label = "PUBLIC" if is_public else "private"
            print(f"           Subnet: {subnet.display_name} [{label}]")
            if is_public and not subnet_id:
                subnet_id = subnet.id

    if subnet_id:
        check("Found a public subnet", True, f"ID: {subnet_id[:40]}...")
    else:
        check("Found a public subnet", False, "No public subnet found!")

    # --- Discover image ---
    print()
    print("6. Discovering Ubuntu 24.04 ARM image...")

    compute = oci.core.ComputeClient(config)
    images = compute.list_images(
        compartment_id,
        operating_system="Canonical Ubuntu",
        shape="VM.Standard.A1.Flex",
        sort_by="TIMECREATED",
        sort_order="DESC",
    ).data

    image_id = None
    for img in images:
        if "24.04" in img.display_name and "aarch64" in img.display_name:
            image_id = img.id
            break

    if image_id:
        check("Found image", True, f"{img.display_name}")
    else:
        check("Found Ubuntu 24.04 aarch64 image", False)
        print("         Available images:")
        for img in images[:5]:
            print(f"           - {img.display_name}")

    # --- Check SSH key ---
    print()
    print("7. Checking SSH public key...")

    with open(SSH_KEY_PATH, "r") as f:
        ssh_key = f.read().strip()

    starts_ok = ssh_key.startswith("ssh-rsa") or ssh_key.startswith("ssh-ed25519") or ssh_key.startswith("ecdsa-")
    check("SSH key format looks valid", starts_ok, f"{ssh_key[:60]}...")

    # --- Summary ---
    print()
    print("=" * 60)
    print("  SUMMARY - What the real script would do:")
    print("=" * 60)
    print()

    all_good = subnet_id and image_id and starts_ok

    if all_good:
        print(f"  Instance name:  {INSTANCE_NAME}")
        print(f"  Shape:          VM.Standard.A1.Flex ({OCPUS} OCPU, {MEMORY_GB} GB)")
        print(f"  Image:          {img.display_name}")
        print(f"  Subnet:         {subnet_id[:50]}...")
        print(f"  ADs to try:     {', '.join(ad.name for ad in ads)}")
        print()
        print("  The script would loop through all ADs every 5 minutes,")
        print("  trying to create this instance until Oracle has capacity.")
        print()
        print("  EVERYTHING LOOKS GOOD. Ready to run for real.")
    else:
        print("  ISSUES FOUND. Fix the problems above before running.")

    print()


if __name__ == "__main__":
    main()
