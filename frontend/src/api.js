const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

export async function searchJobs({
  q,
  location,
  page = 1,
  resultsPerPage = 20,
  salaryMin,
  salaryMax,
  jobType,
  company,
  maxDaysOld,
  sortBy
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (location) params.set("location", location);
  params.set("page", String(page));
  params.set("results_per_page", String(resultsPerPage));
  if (salaryMin) params.set("salary_min", String(salaryMin));
  if (salaryMax) params.set("salary_max", String(salaryMax));
  if (jobType && jobType !== "any") params.set("job_type", jobType);
  if (company) params.set("company", company);
  if (maxDaysOld) params.set("max_days_old", String(maxDaysOld));
  if (sortBy && sortBy !== "relevance") params.set("sort_by", sortBy);

  const url = API_BASE + "/api/jobs?" + params.toString();
  const res = await fetch(url);
  if (!res.ok) {
    const detail = await res.text();
    throw new Error("Request failed (" + res.status + "): " + detail);
  }
  return res.json();
}
