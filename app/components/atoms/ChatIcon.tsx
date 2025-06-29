export function ChatIcon({
  className,
  onClick,
}: {
  className?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className='fixed bottom-5 right-5 bg-blue-500 text-white p-4 rounded-full shadow-lg hover:bg-blue-600 transition'
    >
      <svg
        xmlns='http://www.w3.org/2000/svg'
        fill='none'
        viewBox='0 0 24 24'
        strokeWidth='2'
        stroke='currentColor'
        className='w-6 h-6'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          d='M12 20.25c4.97 0 9-3.813 9-8.504 0-4.692-4.03-8.496-9-8.496S3 7.054 3 11.746c0 1.846.728 3.559 1.938 4.875L3 20.25l5.455-2.224a10.5 10.5 0 003.545.624z'
        />
      </svg>
    </button>
  )
}
