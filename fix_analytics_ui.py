import re

with open("apps/web/src/features/learning/components/LearningAnalytics.tsx", "r") as f:
    text = f.read()

# Fix empty state logic
empty_state_replacement = """  const hasPlans = summary.active_plans_count > 0 || summary.completed_plans_count > 0;
  const hasWatchActivity = summary.total_watched_seconds > 0;

  if (!hasPlans && !hasWatchActivity) {
    return (
      <div className="flex flex-col items-center justify-center p-12 sm:p-24 text-center border border-[#BFC9D1]/10 border-dashed rounded-2xl bg-[#25343F]/30 mt-8 max-w-4xl mx-auto w-full">
        <div className="w-20 h-20 rounded-full bg-[#BFC9D1]/5 flex items-center justify-center mb-8">
          <TrendingUp className="w-10 h-10 text-[#BFC9D1]/50" />
        </div>
        <h3 className="text-lg font-semibold text-[#EAEFEF] mb-3">
          No learning activity yet
        </h3>
        <p className="text-sm text-[#BFC9D1] max-w-sm mb-8">
          Start a learning plan and your study history will appear here.
        </p>
        <Link 
          href="/learning"
          className="px-6 py-2.5 bg-[#FF9B51] hover:bg-[#e88a44] text-[#25343F] text-sm font-semibold rounded-lg transition-colors focus:outline-none"
        >
          Explore Learning
        </Link>
      </div>
    );
  }
  
  if (hasPlans && !hasWatchActivity) {
    return (
      <div className="flex flex-col items-center justify-center p-12 sm:p-24 text-center border border-[#BFC9D1]/10 border-dashed rounded-2xl bg-[#25343F]/30 mt-8 max-w-4xl mx-auto w-full">
        <div className="w-20 h-20 rounded-full bg-[#BFC9D1]/5 flex items-center justify-center mb-8">
          <TrendingUp className="w-10 h-10 text-[#BFC9D1]/50" />
        </div>
        <h3 className="text-lg font-semibold text-[#EAEFEF] mb-3">
          No watch activity yet
        </h3>
        <p className="text-sm text-[#BFC9D1] max-w-sm mb-8">
          You have active learning plans, but no watch time recorded in this date range.
        </p>
        <Link 
          href="/learning"
          className="px-6 py-2.5 bg-[#FF9B51] hover:bg-[#e88a44] text-[#25343F] text-sm font-semibold rounded-lg transition-colors focus:outline-none"
        >
          Continue Learning
        </Link>
      </div>
    );
  }

  // Calculate max for chart"""

text = re.sub(r'  const hasActivity = summary\.total_watched_seconds > 0 \|\| summary\.active_plans_count > 0 \|\| summary\.completed_plans_count > 0;[\s\S]*?// Calculate max for chart', empty_state_replacement, text)

# Fix range buttons
range_buttons_replacement = """        <div className="flex bg-[#25343F] border border-[#BFC9D1]/20 rounded-lg overflow-hidden" role="group" aria-label="Date range selector">
          {[7, 30, 90].map(days => (
            <button
              key={days}
              onClick={() => setDaysRange(days)}
              aria-pressed={daysRange === days}
              className={`px-4 py-2 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#FF9B51]/40 ${
                daysRange === days 
                  ? "bg-[#FF9B51]/10 text-[#FF9B51]" 
                  : "text-[#BFC9D1] hover:bg-[#BFC9D1]/5 hover:text-[#EAEFEF]"
              }`}
            >
              {days} Days
            </button>
          ))}
        </div>"""
text = re.sub(r'        <div className="flex bg\[#25343F\] border border\[#BFC9D1\]/20 rounded-lg overflow-hidden">[\s\S]*?</div>', range_buttons_replacement, text)

# Fix summary labels
text = text.replace('Total Watched', 'Total Watched <span className="text-[9px] opacity-70 ml-1">(Selected Range)</span>')
text = text.replace('Active Days', 'Active Days <span className="text-[9px] opacity-70 ml-1">(Selected Range)</span>')

# Fix chart accessibility & historical debt notice
chart_accessibility_replacement = """      {/* Daily Activity Chart */}
      <section className="bg-[#25343F] border border-[#BFC9D1]/10 rounded-xl p-6 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <h3 className="text-base font-semibold text-[#EAEFEF]">Daily Activity ({daysRange} days)</h3>
            <p className="text-[10px] text-[#BFC9D1] italic">Historical catch-up snapshots are not available.</p>
        </div>
        
        {loading ? (
          <div className="h-40 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-[#FF9B51] animate-spin" />
          </div>
        ) : (
          <>
            <div className="sr-only">
              <h4>Accessible Daily Activity Data</h4>
              <ul>
                {daily_history.map((day, i) => (
                  <li key={`sr-${i}`}>
                    {formatDate(day.date)}: {formatDuration(day.watched_seconds)} watched.
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex items-end gap-1 sm:gap-2 h-40 w-full pt-4" aria-hidden="true">
              {daily_history.map((day, i) => {"""

text = re.sub(r'      \{\/\* Daily Activity Chart \*\/.*?<h3 className="text-base font-semibold text-\[#EAEFEF\]">Daily Activity \(\{daysRange\} days\)</h3>\s*\{loading \? \(\s*<div className="h-40 flex items-center justify-center">\s*<Loader2 className="w-8 h-8 text-\[#FF9B51\] animate-spin" />\s*</div>\s*\) : \(\s*<div className="flex items-end gap-1 sm:gap-2 h-40 w-full pt-4">.*?\{daily_history\.map\(\(day, i\) => \{', chart_accessibility_replacement, text, flags=re.DOTALL)

# Because we opened a <> in the replacement, we must close it.
text = re.sub(r'            \}\)\}\s*</div>\s*\)\}\s*<div className="flex justify-between', r'            })}</div ></>)}\n        <div className="flex justify-between', text)

with open("apps/web/src/features/learning/components/LearningAnalytics.tsx", "w") as f:
    f.write(text)
