import DonorReport from "./DonorReport";

export default function FrequentDonorsReport({ orgName }: { orgName: string }) {
  return <DonorReport mode="frequent" orgName={orgName} />;
}
