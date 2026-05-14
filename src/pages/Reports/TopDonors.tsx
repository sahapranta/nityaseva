import DonorReport from "./DonorReport";

export default function TopDonorsReport({ orgName }: { orgName: string }) {
  return <DonorReport mode="top" orgName={orgName} />;
}
