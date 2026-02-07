import React, { useEffect, useMemo, useState } from "react";
import { searchJobs } from "./api.js";

const SAVED_KEY = "jobboard:saved";

function loadSaved() {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSaved(items) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(items));
}

function useToast() {
  const [toast, setToast] = useState(null);
  function show(message, tone = "info") {
    setToast({ message, tone, id: Date.now() });
    setTimeout(() => setToast(null), 2000);
  }
  return { toast, show };
}

function jobSummary(job) {
  return {
    id: job.id,
    title: job.title,
    company: job.company?.display_name,
    location: job.location?.display_name,
    redirect_url: job.redirect_url,
    created: job.created,
    description: job.description
  };
}

export default function App() {
  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [jobType, setJobType] = useState("any");
  const [company, setCompany] = useState("");
  const [maxDaysOld, setMaxDaysOld] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [resultsPerPage, setResultsPerPage] = useState(20);
  const [sortBy, setSortBy] = useState("relevance");
  const [view, setView] = useState("search");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [saved, setSaved] = useState(() => loadSaved());
  const [initialized, setInitialized] = useState(false);
  const [pendingJobId, setPendingJobId] = useState(null);
  const { toast, show } = useToast();

  useEffect(() => {
    saveSaved(saved);
  }, [saved]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = {
      q: params.get("q") || "",
      location: params.get("location") || "",
      salaryMin: params.get("salary_min") || "",
      salaryMax: params.get("salary_max") || "",
      jobType: params.get("job_type") || "any",
      company: params.get("company") || "",
      maxDaysOld: params.get("max_days_old") || "",
      remoteOnly: params.get("remote_only") === "1",
      resultsPerPage: Number(params.get("results_per_page") || 20),
      page: Number(params.get("page") || 1),
      sortBy: params.get("sort_by") || "relevance",
      view: params.get("view") || "search"
    };
    setQ(initial.q);
    setLocation(initial.location);
    setSalaryMin(initial.salaryMin);
    setSalaryMax(initial.salaryMax);
    setJobType(initial.jobType);
    setCompany(initial.company);
    setMaxDaysOld(initial.maxDaysOld);
    setRemoteOnly(initial.remoteOnly);
    setResultsPerPage(initial.resultsPerPage);
    setPage(initial.page);
    setSortBy(initial.sortBy);
    setView(initial.view);

    const jobId = params.get("job_id");
    if (jobId) setPendingJobId(jobId);

    setInitialized(true);
  }, []);

  function buildParams() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (location) params.set("location", location);
    if (salaryMin) params.set("salary_min", salaryMin);
    if (salaryMax) params.set("salary_max", salaryMax);
    if (jobType && jobType !== "any") params.set("job_type", jobType);
    if (company) params.set("company", company);
    if (maxDaysOld) params.set("max_days_old", maxDaysOld);
    if (remoteOnly) params.set("remote_only", "1");
    if (resultsPerPage) params.set("results_per_page", String(resultsPerPage));
    if (page) params.set("page", String(page));
    if (sortBy && sortBy !== "relevance") params.set("sort_by", sortBy);
    if (view && view !== "search") params.set("view", view);
    if (selected?.id) params.set("job_id", String(selected.id));
    return params;
  }

  function updateUrl() {
    const params = buildParams();
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", newUrl);
  }

  function resetFilters() {
    setQ("");
    setLocation("");
    setSalaryMin("");
    setSalaryMax("");
    setJobType("any");
    setCompany("");
    setMaxDaysOld("");
    setRemoteOnly(false);
    setResultsPerPage(20);
    setSortBy("relevance");
    setPage(1);
  }

  useEffect(() => {
    if (!initialized) return;
    updateUrl();
  }, [
    initialized,
    q,
    location,
    salaryMin,
    salaryMax,
    jobType,
    company,
    maxDaysOld,
    remoteOnly,
    resultsPerPage,
    page,
    sortBy,
    view,
    selected
  ]);

  async function onSearch(nextPage = 1) {
    setLoading(true);
    setError("");
    try {
      const data = await searchJobs({
        q,
        location,
        page: nextPage,
        resultsPerPage,
        salaryMin,
        salaryMax,
        jobType,
        company,
        maxDaysOld,
        sortBy
      });
      setResults(data);
      setPage(nextPage);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const hasQuery =
      q ||
      location ||
      company ||
      salaryMin ||
      salaryMax ||
      jobType !== "any";
    if (!hasQuery) return;
    const t = setTimeout(() => {
      onSearch(1);
    }, 500);
    return () => clearTimeout(t);
  }, [
    q,
    location,
    company,
    salaryMin,
    salaryMax,
    jobType,
    maxDaysOld,
    remoteOnly,
    resultsPerPage,
    sortBy
  ]);

  const jobs = results?.results || [];
  const count = results?.count || 0;
  const totalPages = resultsPerPage ? Math.ceil(count / resultsPerPage) : 1;

  const filteredJobs = useMemo(() => {
    const now = Date.now();
    return jobs.filter((job) => {
      if (remoteOnly) {
        const hay = `${job.title} ${job.description} ${job.location?.display_name}`.toLowerCase();
        if (!hay.includes("remote")) return false;
      }
      if (maxDaysOld) {
        const created = job.created ? Date.parse(job.created) : 0;
        const daysOld = created ? (now - created) / (1000 * 60 * 60 * 24) : 9999;
        if (daysOld > Number(maxDaysOld)) return false;
      }
      if (company) {
        const c = job.company?.display_name || "";
        if (!c.toLowerCase().includes(company.toLowerCase())) return false;
      }
      return true;
    });
  }, [jobs, remoteOnly, maxDaysOld, company]);

  const savedIds = new Set(saved.map((s) => s.id));

  function toggleSave(job) {
    if (savedIds.has(job.id)) {
      setSaved(saved.filter((s) => s.id !== job.id));
    } else {
      setSaved([jobSummary(job), ...saved]);
    }
  }

  const pageNumbers = useMemo(() => {
    const pages = [];
    const max = Math.min(totalPages, 5);
    let start = Math.max(1, page - 2);
    let end = start + max - 1;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - max + 1);
    }
    for (let i = start; i <= end; i += 1) pages.push(i);
    return pages;
  }, [page, totalPages]);

  const showEmpty = !loading && results && filteredJobs.length === 0;

  useEffect(() => {
    if (!pendingJobId) return;
    const match =
      jobs.find((j) => String(j.id) === String(pendingJobId)) ||
      saved.find((j) => String(j.id) === String(pendingJobId));
    if (match) {
      setSelected(match);
      setPendingJobId(null);
    }
  }, [pendingJobId, jobs, saved]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "/" && view === "search") {
        e.preventDefault();
        const input = document.querySelector(".search-row input");
        if (input) input.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view]);

  function copyShareLink(job) {
    const params = buildParams();
    params.set("job_id", String(job.id));
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
      show("Link copied");
    }
  }

  return (
    <div className="app">
      <header>
        <div className="brand">
          <h1>Job Board</h1>
          <p>Search jobs powered by Adzuna</p>
        </div>
        <nav className="tabs">
          <button
            className={view === "search" ? "active" : ""}
            onClick={() => setView("search")}
          >
            Search
          </button>
          <button
            className={view === "saved" ? "active" : ""}
            onClick={() => setView("saved")}
          >
            Saved ({saved.length})
          </button>
        </nav>
      </header>

      {view === "search" && (
        <section className="filters">
          <div className="search-row">
            <input
              placeholder="Role, skill, or company"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <input
              placeholder="City, state, or remote"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <button onClick={() => onSearch(1)} disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </button>
          </div>

          <div className="filter-row">
            <input
              type="number"
              placeholder="Salary min"
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
            />
            <input
              type="number"
              placeholder="Salary max"
              value={salaryMax}
              onChange={(e) => setSalaryMax(e.target.value)}
            />
            <select value={jobType} onChange={(e) => setJobType(e.target.value)}>
              <option value="any">Any type</option>
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="contract">Contract</option>
              <option value="permanent">Permanent</option>
            </select>
            <input
              placeholder="Company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
            <select
              value={maxDaysOld}
              onChange={(e) => setMaxDaysOld(e.target.value)}
            >
              <option value="">Any time</option>
              <option value="1">Last 24 hours</option>
              <option value="3">Last 3 days</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>
            <select
              value={resultsPerPage}
              onChange={(e) => setResultsPerPage(Number(e.target.value))}
            >
              <option value="10">10 / page</option>
              <option value="20">20 / page</option>
              <option value="50">50 / page</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="relevance">Sort: Relevance</option>
              <option value="date">Sort: Date</option>
              <option value="salary">Sort: Salary</option>
            </select>
            <label className="toggle">
              <input
                type="checkbox"
                checked={remoteOnly}
                onChange={(e) => setRemoteOnly(e.target.checked)}
              />
              Remote only
            </label>
            <button className="ghost" onClick={resetFilters}>
              Clear filters
            </button>
            <span className="hint">Tip: press "/" to focus search</span>
          </div>
        </section>
      )}

      {error && <div className="error">Error: {error}</div>}

      {view === "saved" && (
        <section className="saved">
          <h2>Saved Jobs</h2>
          {saved.length === 0 && <div className="empty">No saved jobs yet.</div>}
          <ul>
            {saved.map((job) => (
              <li key={job.id}>
                <span className="title">{job.title}</span>
                <span className="company">{job.company}</span>
                {job.redirect_url && (
                  <a href={job.redirect_url} target="_blank" rel="noreferrer">
                    View
                  </a>
                )}
                <button className="ghost" onClick={() => setSelected(job)}>
                  Details
                </button>
                <button className="ghost" onClick={() => toggleSave(job)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view === "search" && (
        <section className="results">
          <div className="meta">
            {count > 0 && <span>{count.toLocaleString()} jobs found</span>}
          </div>

          {loading && (
            <ul className="skeletons">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="job skeleton">
                  <div className="line wide" />
                  <div className="line" />
                  <div className="line short" />
                </li>
              ))}
            </ul>
          )}

          {showEmpty && <div className="empty">No jobs match these filters.</div>}

          {!loading && (
            <ul>
              {filteredJobs.map((job) => (
                <li key={job.id} className="job">
                  <div className="title">{job.title}</div>
                  <div className="company">{job.company?.display_name}</div>
                  <div className="location">{job.location?.display_name}</div>
                  <div className="desc">{job.description?.slice(0, 180)}...</div>
                  <div className="actions">
                    <button className="ghost" onClick={() => setSelected(job)}>
                      Details
                    </button>
                    <button className="ghost" onClick={() => toggleSave(job)}>
                      {savedIds.has(job.id) ? "Saved" : "Save"}
                    </button>
                    {job.redirect_url && (
                      <a href={job.redirect_url} target="_blank" rel="noreferrer">
                        View
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {results && totalPages > 1 && (
            <div className="pager">
              <button
                onClick={() => onSearch(Math.max(1, page - 1))}
                disabled={page <= 1 || loading}
              >
                Prev
              </button>
              {pageNumbers.map((p) => (
                <button
                  key={p}
                  className={p === page ? "active" : ""}
                  onClick={() => onSearch(p)}
                  disabled={loading}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => onSearch(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages || loading}
              >
                Next
              </button>
            </div>
          )}
        </section>
      )}

      {selected && (
        <div className="overlay" onClick={() => setSelected(null)}>
          <div className="panel" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head">
              <h3>{selected.title}</h3>
              <button className="ghost" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <div className="panel-meta">
              <div>{selected.company?.display_name || selected.company}</div>
              <div>{selected.location?.display_name || selected.location}</div>
              {selected.contract_type && <div>{selected.contract_type}</div>}
              {selected.created && (
                <div>Posted: {new Date(selected.created).toLocaleDateString()}</div>
              )}
              {(selected.salary_min || selected.salary_max) && (
                <div>
                  Salary: {selected.salary_min || "?"} - {selected.salary_max || "?"}
                </div>
              )}
            </div>
            <p className="panel-desc">{selected.description}</p>
            <div className="actions">
              <button className="ghost" onClick={() => toggleSave(selected)}>
                {savedIds.has(selected.id) ? "Saved" : "Save"}
              </button>
              <button className="ghost" onClick={() => copyShareLink(selected)}>
                Share
              </button>
              {selected.redirect_url && (
                <a href={selected.redirect_url} target="_blank" rel="noreferrer">
                  Apply / View
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.tone}`} key={toast.id}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
