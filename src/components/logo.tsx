export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-serif leading-[1.1] ${className}`}>
      Oui<em className="text-or">Snap</em>
    </span>
  );
}
