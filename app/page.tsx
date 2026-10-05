import StoreShell from '@/components/StoreShell';
import { getHomeData } from '@/lib/tmdb';

export default async function HomePage() {
  const data = await getHomeData();
  return <StoreShell data={data} />;
}
