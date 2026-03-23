export default function ProgressSteps({ current, labels, skipped = [] }) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        {labels.map((label, i) => {
          const isSkipped = skipped.includes(i)
          const isDone = i < current && !isSkipped
          const isCurrent = i === current
          return (
            <div key={i} className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300
                  ${isDone    ? 'bg-blue-500 text-white' :
                    isCurrent ? 'bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-900' :
                    isSkipped ? 'bg-slate-800 text-slate-600 border border-dashed border-slate-600' :
                                'bg-slate-700 text-slate-500'}`}
              >
                {isDone ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : isSkipped ? '—' : (i + 1)}
              </div>
              <span className={`text-[10px] mt-1 font-medium whitespace-nowrap transition-colors ${
                isCurrent ? 'text-blue-400' :
                isDone    ? 'text-blue-600' :
                isSkipped ? 'text-slate-700' :
                            'text-slate-600'
              }`}>
                {label}{isSkipped ? ' (skipped)' : ''}
              </span>
            </div>
          )
        }).reduce((acc, el, i, arr) => {
          acc.push(el)
          if (i < arr.length - 1) {
            const isSkippedLine = skipped.includes(i) || skipped.includes(i + 1)
            acc.push(
              <div key={`line-${i}`} className="flex-1 h-px mt-[-14px] mx-1">
                <div className={`h-full transition-all duration-300 ${
                  isSkippedLine ? 'bg-slate-800 border-t border-dashed border-slate-700' :
                  i < current   ? 'bg-blue-500' : 'bg-slate-700'
                }`} />
              </div>
            )
          }
          return acc
        }, [])}
      </div>
    </div>
  )
}
