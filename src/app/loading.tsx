import { BrandLogo } from "@/components/brand/BrandLogo";

export default function GlobalLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-[#070B19] px-4">
      <div className="animate-pulse">
        <BrandLogo brandName="IPcore" size="lg" />
      </div>
      <p className="text-xs text-slate-400">Loading IPcore...</p>
    </div>
  );
}
