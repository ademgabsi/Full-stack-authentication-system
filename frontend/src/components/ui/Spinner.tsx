export function Spinner({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary-600" />
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Spinner />
    </div>
  );
}