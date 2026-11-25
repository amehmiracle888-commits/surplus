import { CustomerServicesClient } from "@/components/dashboard/CustomerServicesClient";

export default function MyVpnsPage() {
  return (
    <CustomerServicesClient
      category="vpn"
      title="My VPN Subscriptions"
      emptyMessage="You have no VPN subscriptions yet. Browse VPN plans to get started."
    />
  );
}
