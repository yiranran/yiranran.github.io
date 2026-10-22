/* ============================================================
 * Renderer — fetches data/*.json and populates the template.
 * Class names align with files/styles.css (master-derived design).
 * No build step, no framework.
 * ============================================================ */
(function () {
    "use strict";

    // ---------- helpers ----------------------------------------------------

    const slot = (name) => document.querySelector(`[data-section="${name}"]`);
    const $ = (sel, root = document) => root.querySelector(sel);

    function loadJSON(name) {
        return fetch(`./data/${name}.json`, { cache: "no-store" }).then((r) => {
            if (!r.ok) throw new Error(`Failed to load data/${name}.json (${r.status})`);
            return r.json();
        });
    }

    function el(tag, attrs = {}, children = []) {
        const node = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs)) {
            if (v === null || v === undefined || v === false) continue;
            if (k === "class") node.className = v;
            else if (k === "html") node.innerHTML = v;
            else if (k === "text") node.textContent = v;
            else if (k === "style") node.setAttribute("style", v);
            else if (k.startsWith("on") && typeof v === "function")
                node.addEventListener(k.slice(2).toLowerCase(), v);
            else node.setAttribute(k, v);
        }
        const kids = Array.isArray(children) ? children : [children];
        kids.forEach((c) => {
            if (c == null || c === false) return;
            node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
        });
        return node;
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, (c) => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
        })[c]);
    }

    // ---------- link icons -------------------------------------------------

    const ICONS = {
        github:  `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>`,
        paper:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
        arxiv:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l8 16 8-16"/><path d="M8 4l4 8 4-8"/></svg>`,
        code:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
        project: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>`,
        demo:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="6 4 20 12 6 20 6 4"/></svg>`,
        blog:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>`,
        dataset: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.66 4 3 9 3s9-1.34 9-3V5M3 11v6c0 1.66 4 3 9 3s9-1.34 9-3v-6"/></svg>`,
    };

    function actionKind(label, href = "") {
        const s = (label + " " + href).toLowerCase();
        if (s.includes("demo")) return "demo";
        if (s.includes("project")) return "project";
        if (s.includes("arxiv")) return "arxiv";
        if (s.includes("github") || s.includes("code")) return "code";
        if (s.includes("dataset")) return "dataset";
        if (s.includes("blog") || s.includes("解读")) return "blog";
        if (s.includes("paper") || s.includes("pdf")) return "paper";
        return "paper";
    }

    function normalizeLabel(label) {
        label = label.replace(/\s+/g, " ").trim().replace(/^\[/, "").replace(/\]$/, "").trim();
        const l = label.toLowerCase();
        if (l === "arxiv") return "arXiv";
        if (l === "blog(中文解读)") return "Blog 中文解读";
        return label.charAt(0).toUpperCase() + label.slice(1);
    }

    function actionLink(link) {
        const label = normalizeLabel(link.label || link.type || "Paper");
        const kind = link.type || actionKind(label, link.href);
        return el(
            "a",
            { class: `publication-action publication-action-${kind}`, href: link.href, target: "_blank", rel: "noopener noreferrer" },
            [
                el("span", { class: "publication-action-icon", html: ICONS[kind] || ICONS.paper }),
                el("span", { class: "publication-action-label", text: label }),
            ]
        );
    }

    // ---------- profile (hero) ---------------------------------------------

    function renderProfile(p) {
        const target = slot("profile");
        target.innerHTML = "";

        const copy = el("div", { class: "hero-copy" });
        copy.appendChild(
            el("h1", {}, [
                p.name + " ",
                el("span", { text: p.nameZh || "" }),
            ])
        );
        if (p.title) copy.appendChild(el("p", { class: "hero-title", text: p.title }));
        if (p.affiliation) copy.appendChild(el("p", { class: "hero-affiliation", text: p.affiliation }));
        if (p.summary) copy.appendChild(el("p", { class: "hero-summary", text: p.summary }));

        const contact = el("div", { class: "contact-list", "aria-label": "Contact information" });
        if (p.email) contact.appendChild(el("a", { href: `mailto:${p.email}`, text: p.email }));
        if (p.office) contact.appendChild(el("span", { text: p.office }));
        copy.appendChild(contact);

        if (Array.isArray(p.actions) && p.actions.length) {
            const actions = el("div", { class: "hero-actions" });
            p.actions.forEach((a) => {
                actions.appendChild(
                    el("a", {
                        class: `button${a.primary ? " primary" : ""}`,
                        href: a.href,
                        target: a.href && a.href.startsWith("#") ? null : "_blank",
                        rel: a.href && a.href.startsWith("#") ? null : "noopener noreferrer",
                        text: a.label,
                    })
                );
            });
            copy.appendChild(actions);
        }

        target.appendChild(copy);

        if (p.photo) {
            const fig = el("figure", { class: "portrait-wrap" });
            fig.appendChild(el("img", { src: p.photo, alt: p.name, width: 220, height: 260 }));
            target.appendChild(fig);
        }
    }

    // ---------- bio --------------------------------------------------------

    function renderBio(b) {
        const target = slot("bio");
        target.innerHTML = b.htmlContent || "";
    }

    // ---------- news -------------------------------------------------------

    function renderNews(items) {
        const target = slot("news");
        items.forEach((n) => {
            const li = el("li");
            if (n.highlight) {
                li.className = "highlight";
                li.innerHTML = `<span class="highlight-tag">★</span>` + (n.htmlContent || escapeHtml(n.text || ""));
            } else {
                const dateStr = n.date || "";
                li.appendChild(el("time", { text: dateStr, datetime: dateStr }));
                const body = el("div");
                // Prefer the clean `summary` field (no leading [date] prefix)
                body.innerHTML = n.summary || n.htmlContent || escapeHtml(n.text || "");
                li.appendChild(body);
            }
            target.appendChild(li);
        });
    }

    // ---------- interests --------------------------------------------------

    function renderInterests(d) {
        const target = slot("interests");
        if (d.summary) target.appendChild(el("p", { class: "lead", text: d.summary }));
        if (Array.isArray(d.items) && d.items.length) {
            const ul = el("ul", { class: "tag-list" });
            d.items.forEach((t) => ul.appendChild(el("li", { text: t })));
            target.appendChild(ul);
        }
    }

    // ---------- research funding ------------------------------------------

    function renderFunding(data) {
        const target = slot("funding");
        data.items.forEach((project) => {
            const details = [
                project.title !== project.program ? project.title : null,
                project.period,
                project.budget,
                project.role,
            ].filter(Boolean);
            target.appendChild(el("li", {}, [
                el("strong", { text: project.program }),
                `，${details.join("，")}`,
            ]));
        });
        if (data.industryCollaborations) {
            target.appendChild(el("li", {}, [
                el("strong", { text: "企业合作：" }),
                data.industryCollaborations,
            ]));
        }
    }

    // ---------- openings ---------------------------------------------------

    function renderOpenings(d) {
        const target = slot("openings");
        (d.paragraphs || []).forEach((html) => {
            const p = el("p");
            p.innerHTML = html;
            target.appendChild(p);
        });
    }

    // ---------- publications ----------------------------------------------

    function cleanName(a) {
        // Prefer the explicit `display` field; otherwise strip trailing markers
        // ("*" corresponding, "#" equal) from `name` so we don't double them up.
        const raw = a.display || a.name || "";
        return raw.replace(/[*#†]+$/, "").trim();
    }

    function authorsHtml(authors, showCorrespondingOverride = false) {
        const showCorresponding = showCorrespondingOverride || authors.some((a) => a.isMe && a.corresponding);
        const showEqual = authors.some((a) => a.isMe && a.equal);
        return authors
            .map((a) => {
                let s = escapeHtml(cleanName(a));
                if (a.isMe) s = `<strong class="me">${s}</strong>`;
                if (showCorresponding && a.corresponding) s += "*";
                if (showEqual && a.equal) s += "<sup>#</sup>";
                if (a.isMe && a.projectLead) s += '<sup title="Project Lead">†</sup>';
                return s;
            })
            .join(", ");
    }

    function cleanVenueShort(s) {
        if (!s) return "";
        return String(s)
            .replace(/\s*\((Oral|Spotlight|Highlight)\)\s*$/i, "")
            .replace(/\s+(Oral|Spotlight|Highlight)\s*$/i, "")
            .replace(/\s+\d{4}\s*$/, "")
            .trim();
    }

    function badgesHtml(p) {
        const badges = [];

        // venue badge (e.g. "CVPR 2026", "TPAMI 2024") — prepend
        const short = cleanVenueShort(p.venueShort);
        if (short) {
            const txt = p.year ? `${short} ${p.year}` : short;
            badges.push(`<span class="pub-badge venue">${escapeHtml(txt)}</span>`);
        }

        // CCF tier badges
        (p.tags || []).forEach((t) => {
            const m = /CCF\s*([ABC])/i.exec(t);
            if (m) badges.push(`<span class="pub-badge ccf-${m[1].toLowerCase()}">CCF ${m[1].toUpperCase()}</span>`);
            else badges.push(`<span class="pub-badge">${escapeHtml(t)}</span>`);
        });

        if (p.oral) badges.push(`<span class="pub-badge oral">Oral</span>`);
        if (p.spotlight) badges.push(`<span class="pub-badge spotlight">Spotlight</span>`);

        return badges.length ? `<div class="publication-badges">${badges.join("")}</div>` : "";
    }

    function publicationCard(p) {
        const article = el("article", { class: "publication-item" });

        const imgWrap = el("div", { class: "publication-image" });
        if (p.image) {
            const img = el("img", { src: p.image, alt: "", loading: "lazy" });
            img.onerror = () => {
                const ph = el("div", { class: "ph" });
                imgWrap.replaceChild(ph, img);
            };
            imgWrap.appendChild(img);
        } else {
            imgWrap.appendChild(el("div", { class: "ph" }));
        }
        article.appendChild(imgWrap);

        const body = el("div", { class: "publication-content" });
        body.appendChild(el("div", { class: "publication-title", text: p.title }));

        const authorsDiv = el("div", { class: "publication-authors" });
        authorsDiv.innerHTML = authorsHtml(p.authors || [], p.showCorresponding === true);
        body.appendChild(authorsDiv);

        // Venue row: full venue name on the left, then badges (venue short
        // + year, CCF tier, Oral/Spotlight) inline on the right.
        const badges = badgesHtml(p);
        const showVenueFull =
            p.venueFull &&
            p.venueFull !== p.venueShort &&
            cleanVenueShort(p.venueShort) !== p.venueFull;
        const showYearOnly = !p.venueShort && p.year;

        if (showVenueFull || showYearOnly || badges) {
            const row = el("div", { class: "publication-venue-row" });
            if (showVenueFull) {
                row.appendChild(el("span", { class: "publication-venue", text: p.venueFull }));
            } else if (showYearOnly) {
                row.appendChild(el("span", { class: "publication-venue", text: String(p.year) }));
            }
            if (badges) {
                const wrap = el("span");
                wrap.innerHTML = badges;
                row.appendChild(wrap);
            }
            body.appendChild(row);
        }

        if (Array.isArray(p.links) && p.links.length) {
            const actions = el("div", { class: "publication-actions" });
            p.links.forEach((l) => actions.appendChild(actionLink(l)));
            body.appendChild(actions);
        }

        article.appendChild(body);
        return article;
    }

    function groupPublications(items) {
        const recent = [];
        const byYear = new Map();
        items.forEach((p) => {
            if (p.section === "recent" || (!p.year && p.section !== "yearly")) {
                recent.push(p);
            } else {
                const y = p.year || "Other";
                if (!byYear.has(y)) byYear.set(y, []);
                byYear.get(y).push(p);
            }
        });
        const years = [...byYear.keys()]
            .filter((y) => typeof y === "number")
            .sort((a, b) => b - a);
        if (byYear.has("Other")) years.push("Other");
        return { recent, byYear, years };
    }

    function renderPublications(pubs) {
        const target = slot("publications");
        const { recent, byYear, years } = groupPublications(pubs.items);

        // year nav
        const yearNav = slot("yearnav");
        if (recent.length) yearNav.appendChild(el("a", { href: "#pubA", text: "Recent" }));
        years.forEach((y) =>
            yearNav.appendChild(el("a", { href: `#pub${y}`, text: String(y) }))
        );

        // recent
        if (recent.length) {
            target.appendChild(
                el("div", { class: "publication-section" }, [
                    el("h3", { id: "pubA", text: "Recent works" }),
                    el("span", { class: "publication-count", text: `${recent.length} ${recent.length === 1 ? "paper" : "papers"}` }),
                ])
            );
            const grid = el("div", { class: "publication-list" });
            recent.forEach((p) => grid.appendChild(publicationCard(p)));
            target.appendChild(grid);
        }

        // per-year
        years.forEach((y) => {
            const list = byYear.get(y);
            target.appendChild(
                el("div", { class: "publication-section" }, [
                    el("h3", { id: `pub${y}`, text: String(y) }),
                    el("span", { class: "publication-count", text: `${list.length} ${list.length === 1 ? "paper" : "papers"}` }),
                ])
            );
            const grid = el("div", { class: "publication-list" });
            list.forEach((p) => grid.appendChild(publicationCard(p)));
            target.appendChild(grid);
        });

        // meta
        const meta = slot("pubmeta");
        meta.innerHTML = "";
        if (pubs.summary) {
            meta.appendChild(el("p", { html: typeof pubs.summary === "string" ? pubs.summary : "" }));
        }
        meta.appendChild(
            el("p", {
                text: "* corresponding author     # equal contribution     † Project Lead",
            })
        );
    }

    // ---------- selected open-source projects -----------------------------

    async function updateProjectStars(repos, count, snapshot) {
        const uniqueRepos = [...new Set(repos)];
        const cacheKey = `project-stars:${uniqueRepos.join(",")}`;
        let cached;
        try {
            cached = JSON.parse(localStorage.getItem(cacheKey));
        } catch (_) { /* Storage may be unavailable. */ }
        const validCache = cached && Number.isInteger(cached.total) && cached.total >= 0;
        const validSnapshot = snapshot && Number.isInteger(snapshot.count) && snapshot.count >= 0;
        const showTotal = (total) => {
            count.textContent = total.toLocaleString("en-US");
            count.title = `${uniqueRepos.length > 1 ? "Combined stars" : "GitHub stars"}: ${uniqueRepos.join(" + ")}`;
        };
        if (validSnapshot) {
            showTotal(snapshot.count);
            count.title += ` (last verified ${snapshot.checkedAt})`;
        }
        if (validCache) {
            showTotal(cached.total);
            if (Date.now() - cached.updatedAt < 60 * 60 * 1000) return;
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
            const stars = await Promise.all(uniqueRepos.map(async (repo) => {
                const response = await fetch(`https://api.github.com/repos/${repo}`, {
                    credentials: "omit",
                    signal: controller.signal,
                    headers: { Accept: "application/vnd.github+json" },
                });
                if (!response.ok) throw new Error(`GitHub stars unavailable (${response.status})`);
                const data = await response.json();
                if (!Number.isInteger(data.stargazers_count) || data.stargazers_count < 0)
                    throw new Error("Invalid GitHub star count");
                return data.stargazers_count;
            }));
            const total = stars.reduce((sum, value) => sum + value, 0);
            showTotal(total);
            try {
                localStorage.setItem(cacheKey, JSON.stringify({ total, updatedAt: Date.now() }));
            } catch (_) { /* The live count works without storage. */ }
        } catch (_) {
            if (!validCache && !validSnapshot) count.textContent = "—";
            if (validCache) count.title = "Last available star count";
            else if (!validSnapshot) count.title = "Star count temporarily unavailable";
        } finally {
            clearTimeout(timeout);
            controller.abort();
        }
    }

    function renderProjects(projects) {
        const target = slot("projects");
        projects.items.forEach((p) => {
            const li = el("li");
            const heading = el("div", { class: "project-heading" }, [el("strong", { text: p.name })]);
            const count = el("span", { class: "combined-star-count", text: "…", "aria-live": "polite" });
            const stars = el("span", { class: "combined-stars" });
            if (p.starRepos && p.starRepos.length > 1) {
                p.starRepos.forEach((repository, i) => {
                    if (i) stars.appendChild(el("span", { text: "+" }));
                    stars.appendChild(el("a", {
                        class: "combined-star-link", href: `https://github.com/${repository.repo}`,
                        target: "_blank", rel: "noopener noreferrer",
                        title: repository.repo,
                    }, [
                        el("span", { class: "repository-github-icon", html: ICONS.github, "aria-hidden": "true" }),
                        repository.label,
                    ]));
                });
                stars.appendChild(el("span", { class: "combined-star-label", text: "= ★ Total stars" }));
                updateProjectStars(p.starRepos.map(repository => repository.repo), count, p.starsSnapshot);
            } else {
                stars.appendChild(el("a", {
                    class: "combined-star-link", href: `https://github.com/${p.repo}`,
                    target: "_blank", rel: "noopener noreferrer", title: p.repo,
                }, [
                    el("span", { class: "repository-github-icon", html: ICONS.github, "aria-hidden": "true" }),
                    "Star",
                ]));
                updateProjectStars([p.repo], count, p.starsSnapshot);
            }
            stars.appendChild(count);
            heading.appendChild(stars);
            li.appendChild(heading);
            li.appendChild(el("p", { class: "project-description", text: p.description }));
            target.appendChild(li);
        });
    }

    // ---------- awards -----------------------------------------------------

    function renderAwards(items) {
        const target = slot("awards");
        items.forEach((a) => {
            if (a.hidden) return;
            const li = el("li");
            const span = el("span");
            span.innerHTML = a.htmlContent || escapeHtml(a.text || "");
            li.appendChild(span);
            if (a.date) {
                li.appendChild(document.createTextNode(", "));
                li.appendChild(el("time", { text: a.date }));
            }
            target.appendChild(li);
        });
    }

    // ---------- generic html-list ------------------------------------------

    function renderHtmlList(items, slotName) {
        const target = slot(slotName);
        items.forEach((it) => {
            const li = el("li");
            li.innerHTML = it.htmlContent || escapeHtml(it.text || "");
            target.appendChild(li);
        });
    }

    // ---------- main -------------------------------------------------------

    async function main() {
        try {
            const [profile, bio, news, interests, openings, pubs, awards, edu, work, courses, acts, funding, projects, studentAwards] =
                await Promise.all([
                    loadJSON("profile"),
                    loadJSON("bio"),
                    loadJSON("news"),
                    loadJSON("interests"),
                    loadJSON("openings"),
                    loadJSON("publications"),
                    loadJSON("awards"),
                    loadJSON("education"),
                    loadJSON("working"),
                    loadJSON("courses"),
                    loadJSON("activities"),
                    loadJSON("funding"),
                    loadJSON("projects"),
                    loadJSON("student_awards"),
                ]);

            renderProfile(profile);
            document.title = `${profile.name} | Shanghai Jiao Tong University`;
            renderBio(bio);
            renderNews(news);
            renderInterests(interests);
            renderFunding(funding);
            renderOpenings(openings);
            renderProjects(projects);
            renderPublications(pubs);
            renderAwards(awards);
            renderHtmlList(studentAwards, "student_awards");
            renderHtmlList(edu, "education");
            renderHtmlList(work, "working");
            renderHtmlList(courses, "courses");
            renderHtmlList(acts, "activities");
        } catch (e) {
            console.error(e);
            document.body.appendChild(
                el("div", {
                    style: "color:#b0443d;padding:24px;font-family:monospace;",
                    text: "Failed to render: " + (e.message || e),
                })
            );
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", main);
    } else {
        main();
    }
})();
