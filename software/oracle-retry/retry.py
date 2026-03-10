import oci
import requests
import time
import sys
import os
from datetime import datetime


NTFY_TOPIC = os.environ.get("NTFY_TOPIC", "oracle-retry-changeme")
RETRY_INTERVAL = int(os.environ.get("RETRY_INTERVAL", "300"))
INSTANCE_NAME = os.environ.get("INSTANCE_NAME", "pangolin-headscale")
OCPUS = int(os.environ.get("OCPUS", "1"))
MEMORY_GB = int(os.environ.get("MEMORY_GB", "6"))


def log(msg):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)


def notify(title, message, priority="default", tags=""):
    try:
        requests.post(
            f"https://ntfy.sh/{NTFY_TOPIC}",
            data=message,
            headers={"Title": title, "Priority": priority, "Tags": tags},
        )
    except Exception as e:
        log(f"Failed to send notification: {e}")


def main():
    config = oci.config.from_file("/root/.oci/config")

    compute = oci.core.ComputeClient(config)
    identity = oci.identity.IdentityClient(config)
    network = oci.core.VirtualNetworkClient(config)

    tenancy_id = config["tenancy"]
    compartment_id = tenancy_id
    log(f"Using compartment (tenancy): {compartment_id}")

    # Auto-discover availability domains
    ads = identity.list_availability_domains(compartment_id).data
    log(f"Found {len(ads)} availability domains: {[ad.name for ad in ads]}")

    # Auto-discover first public subnet
    vcns = network.list_vcns(compartment_id).data
    subnet_id = None
    for vcn in vcns:
        subnets = network.list_subnets(compartment_id, vcn_id=vcn.id).data
        for subnet in subnets:
            if not subnet.prohibit_public_ip_on_vnic:
                subnet_id = subnet.id
                log(f"Found public subnet: {subnet.display_name} ({subnet_id})")
                break
        if subnet_id:
            break

    if not subnet_id:
        log("ERROR: No public subnet found. Create one in the Oracle Console first.")
        notify("Oracle Retry Error", "No public subnet found.", "high", "warning")
        sys.exit(1)

    # Auto-discover Ubuntu 24.04 aarch64 image
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
            log(f"Found image: {img.display_name}")
            break

    if not image_id:
        log("ERROR: Could not find Ubuntu 24.04 aarch64 image.")
        notify("Oracle Retry Error", "Image not found.", "high", "warning")
        sys.exit(1)

    # Load SSH public key
    ssh_key_path = "/root/.oci/ssh_key.pub"
    if not os.path.exists(ssh_key_path):
        log("ERROR: SSH public key not found. Place it at oci-config/ssh_key.pub")
        notify("Oracle Retry Error", "SSH public key missing.", "high", "warning")
        sys.exit(1)

    with open(ssh_key_path, "r") as f:
        ssh_public_key = f.read().strip()

    log("Configuration:")
    log(f"  Instance: {INSTANCE_NAME}")
    log(f"  Shape: VM.Standard.A1.Flex ({OCPUS} OCPU, {MEMORY_GB} GB)")
    log(f"  Retry interval: {RETRY_INTERVAL}s")
    log(f"  ntfy topic: {NTFY_TOPIC}")
    log("")
    log("Starting retry loop...")

    notify(
        "Oracle Retry Started",
        f"Trying to create {INSTANCE_NAME}\n{OCPUS} OCPU, {MEMORY_GB} GB RAM\nRetrying every {RETRY_INTERVAL}s",
        "low",
        "rocket",
    )

    attempt = 0
    while True:
        for ad in ads:
            attempt += 1
            log(f"Attempt #{attempt} - Trying {ad.name}...")

            try:
                launch_details = oci.core.models.LaunchInstanceDetails(
                    availability_domain=ad.name,
                    compartment_id=compartment_id,
                    shape="VM.Standard.A1.Flex",
                    display_name=INSTANCE_NAME,
                    image_id=image_id,
                    subnet_id=subnet_id,
                    shape_config=oci.core.models.LaunchInstanceShapeConfigDetails(
                        ocpus=float(OCPUS),
                        memory_in_gbs=float(MEMORY_GB),
                    ),
                    metadata={"ssh_authorized_keys": ssh_public_key},
                    create_vnic_details=oci.core.models.CreateVnicDetails(
                        subnet_id=subnet_id,
                        assign_public_ip=True,
                    ),
                )

                response = compute.launch_instance(launch_details)
                instance = response.data

                log(f"Instance created! ID: {instance.id}")
                log("Waiting for public IP...")

                public_ip = "pending"
                for _ in range(24):
                    time.sleep(5)
                    try:
                        vnic_attachments = compute.list_vnic_attachments(
                            compartment_id, instance_id=instance.id
                        ).data
                        if vnic_attachments:
                            attachment = vnic_attachments[0]
                            if attachment.lifecycle_state == "ATTACHED":
                                vnic = network.get_vnic(attachment.vnic_id).data
                                if vnic.public_ip:
                                    public_ip = vnic.public_ip
                                    break
                    except Exception:
                        pass

                result = {
                    "instance_name": INSTANCE_NAME,
                    "instance_id": instance.id,
                    "availability_domain": ad.name,
                    "public_ip": public_ip,
                    "shape": "VM.Standard.A1.Flex",
                    "ocpus": OCPUS,
                    "memory_gb": MEMORY_GB,
                    "image_id": image_id,
                    "subnet_id": subnet_id,
                    "compartment_id": compartment_id,
                    "created_at": datetime.now().isoformat(),
                    "attempts": attempt,
                }

                msg = (
                    f"Instance: {INSTANCE_NAME}\n"
                    f"AD: {ad.name}\n"
                    f"Public IP: {public_ip}\n"
                    f"Instance ID: {instance.id}\n"
                    f"Created after {attempt} attempts"
                )
                log("")
                log("=" * 50)
                log("SUCCESS!")
                log(msg)
                log("=" * 50)

                # Write result to file
                import json
                result_path = "/app/result/instance-result.json"
                os.makedirs(os.path.dirname(result_path), exist_ok=True)
                with open(result_path, "w") as f:
                    json.dump(result, f, indent=2)
                log(f"Result saved to: {result_path}")

                notify(
                    "Oracle Instance Created!",
                    f"{msg}\n\nSSH: ssh ubuntu@{public_ip}\n\nFull result saved to instance-result.json",
                    "urgent",
                    "tada,computer",
                )
                sys.exit(0)

            except oci.exceptions.ServiceError as e:
                if e.status == 500 and "capacity" in str(e.message).lower():
                    log(f"  -> Out of capacity in {ad.name}")
                elif e.status == 429:
                    log("  -> Rate limited. Waiting extra 60s...")
                    time.sleep(60)
                else:
                    error_msg = f"Error: {e.status} - {e.message}"
                    log(f"  -> {error_msg}")
                    notify("Oracle Retry Error", error_msg, "high", "warning")
            except Exception as e:
                error_msg = f"Exception: {str(e)}"
                log(f"  -> {error_msg}")
                notify("Oracle Retry Error", error_msg, "high", "warning")

        log(f"All ADs tried. Waiting {RETRY_INTERVAL}s before next round...")
        time.sleep(RETRY_INTERVAL)


if __name__ == "__main__":
    main()
