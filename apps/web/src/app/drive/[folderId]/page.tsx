import { DriveExplorer } from "@/components/drive-explorer";

export default async function FolderPage(props: { params: Promise<{ folderId: string }> }) {
  const { folderId } = await props.params;
  return <DriveExplorer folderId={folderId} />;
}
