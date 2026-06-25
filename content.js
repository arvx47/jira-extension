(function () {
  const JIRA_BUTTON_ID = "jqc-jira-btn";
  const BB_BUTTON_ID = "jqc-bb-btn";
  const JIRA_KEY_RE = /[A-Z]+-\d+/;

  // ── Shared helpers ──────────────────────────────────────────────────────────

  function copyRichText(html, plain) {
    try {
      if (typeof ClipboardItem !== "undefined") {
        const htmlBlob = new Blob([html], { type: "text/html" });
        const textBlob = new Blob([plain], { type: "text/plain" });
        navigator.clipboard
          .write([new ClipboardItem({ "text/html": htmlBlob, "text/plain": textBlob })])
          .catch(() => fallbackCopy(plain));
      } else {
        fallbackCopy(plain);
      }
    } catch (e) {
    }
  }

  function fallbackCopy(text) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    } catch (e) {
    }
  }

  function flashButton(btn, success) {
    const original = btn.textContent;
    btn.textContent = success ? "Copied!" : "Error";
    btn.classList.toggle("jqc-success", success);
    btn.classList.toggle("jqc-error", !success);
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("jqc-success", "jqc-error");
    }, 1800);
  }

  function makeButton(id, label, title) {
    const btn = document.createElement("button");
    btn.id = id;
    btn.textContent = label;
    btn.title = title;
    return btn;
  }

  function getJiraBase(cb) {
    chrome.storage.sync.get("jiraBase", ({ jiraBase }) => {
      cb(jiraBase || null);
    });
  }

  // ── Jira ────────────────────────────────────────────────────────────────────

  function getJiraIssueData() {
    const urlMatch = location.pathname.match(/\/browse\/([A-Z]+-\d+)/);
    const keyFromUrl = urlMatch ? urlMatch[1] : null;

    const keyEl =
      document.querySelector('[data-testid="issue.views.issue-base.foundation.breadcrumbs.current-issue.item"]') ||
      document.querySelector('[data-testid="issue-header-actions.ui.components.issue-key"]') ||
      document.querySelector(".issue-header-breadcrumbs .current-item") ||
      document.querySelector("#jira-issue-header-actions a[href*='/browse/']");

    const issueKey = keyFromUrl || (keyEl ? keyEl.textContent.trim() : null);

    const titleEl =
      document.querySelector('[data-testid="issue.views.issue-base.foundation.summary.heading"]') ||
      document.querySelector('[data-testid="issue-title"]') ||
      document.querySelector("#summary-val") ||
      document.querySelector(".issue-header h1") ||
      document.querySelector("h1");

    const title = titleEl ? titleEl.textContent.trim() : null;
    const issueUrl = issueKey ? `${location.origin}/browse/${issueKey}` : location.href;

    return { issueKey, title, issueUrl };
  }

  function injectJiraButton() {
    if (document.getElementById(JIRA_BUTTON_ID)) return;
    const { issueKey } = getJiraIssueData();
    if (!issueKey) return;

    const anchor =
      document.querySelector('[data-testid="issue.views.issue-base.foundation.breadcrumbs.breadcrumb-current-issue-container"]') ||
      document.querySelector('[data-testid="issue-header-actions.ui"]') ||
      document.querySelector("#jira-issue-header-actions") ||
      document.querySelector(".issue-header-breadcrumbs") ||
      document.querySelector(".issue-header");

    if (!anchor) return;

    const btn = makeButton(JIRA_BUTTON_ID, "Copy", "Copy issue key + title as a formatted link");
    btn.addEventListener("click", () => {
      const { issueKey, title, issueUrl } = getJiraIssueData();
      if (!issueKey || !title) { flashButton(btn, false); return; }
      const plain = `${issueKey} ${title}`;
      const html  = `<a href="${issueUrl}">${issueKey}</a> ${title}`;
      copyRichText(html, plain);
      flashButton(btn, true);
    });
    anchor.appendChild(btn);
  }

  // ── Bitbucket ───────────────────────────────────────────────────────────────

  function getPRSizeIcon() {
    // Bitbucket shows file count in the diff tab, e.g. "Files (12)"
    const candidates = Array.from(document.querySelectorAll("span, button, a, [role='tab']"));
    for (const el of candidates) {
      const m = el.textContent.match(/Files\s*\((\d+)\)/i);
      if (m) {
        const count = parseInt(m[1], 10);
        if (count === 1)      return ":baby:";
        if (count <= 3)       return ":shrimp:";
        if (count <= 6)       return ":fish:";
        return ":whale:";
      }
    }
    return ":fish:"; // default when count not found
  }

  function getBitbucketPRData() {
    // URL: /workspace/repo/pull-requests/5282
    const urlMatch = location.pathname.match(/\/pull-requests\/(\d+)/);
    if (!urlMatch) return null;
    const prNumber = urlMatch[1];

    // Title element (Bitbucket Cloud)
    const titleEl =
      document.querySelector('[data-qa="pr-header-title"]') ||
      document.querySelector('h1[data-testid="pull-request-title"]') ||
      document.querySelector(".pull-request-title") ||
      document.querySelector("h1");

    const fullTitle = titleEl ? titleEl.textContent.trim() : null;
    if (!fullTitle) return null;

    // Extract Jira key from title brackets, e.g. [OUT-9113]
    const jiraMatch = fullTitle.match(/\[([A-Z]+-\d+)\]/);
    const jiraKey = jiraMatch ? jiraMatch[1] : null;

    const prUrl = `${location.origin}${location.pathname.replace(/\/pull-requests\/(\d+).*/, "/pull-requests/$1")}`;

    const sizeIcon = getPRSizeIcon();

    return { prNumber, fullTitle, jiraKey, prUrl, sizeIcon };
  }

  function injectBitbucketButton() {
    if (document.getElementById(BB_BUTTON_ID)) return;
    const data = getBitbucketPRData();
    if (!data) return;

    // Anchor: action buttons near the PR title
    const titleEl = document.querySelector('[data-qa="pr-header-title"]') ||
      document.querySelector('h1[data-testid="pull-request-title"]') ||
      document.querySelector("h1");
    const anchor =
      document.querySelector('[data-qa="pr-header-actions"]') ||
      document.querySelector(".pull-request-header-actions") ||
      document.querySelector('[data-qa="pr-header"]') ||
      document.querySelector(".pull-request-header") ||
      titleEl?.parentElement;

    if (!anchor) return;

    const btn = makeButton(BB_BUTTON_ID, "Copy", "Copy PR title as a formatted link");
    btn.addEventListener("click", () => {
      const { fullTitle, jiraKey, prUrl, sizeIcon } = getBitbucketPRData();
      if (!fullTitle) { flashButton(btn, false); return; }

      if (jiraKey) {
        getJiraBase((jiraBase) => {
          const jiraUrl = jiraBase
            ? `https://${jiraBase}/browse/${jiraKey}`
            : null;

          // Plain: ":salesforce: :shrimp: [OUT-9113] PR title https://..."
          const plain = `:salesforce: ${sizeIcon} [${jiraKey}] ${stripBracketedKey(fullTitle)} ${prUrl}`;

          // Rich: linked Jira key inside brackets, rest as plain text
          const linkedKey = jiraUrl
            ? `<a href="${jiraUrl}">${jiraKey}</a>`
            : jiraKey;
          const html = `:salesforce: ${sizeIcon} [${linkedKey}] ${stripBracketedKey(fullTitle)} ${prUrl}`;

          copyRichText(html, plain);
          flashButton(btn, true);
        });
      } else {
        // No Jira key found — copy title + URL only
        const plain = `${fullTitle} ${prUrl}`;
        const html  = `${fullTitle} <a href="${prUrl}">${prUrl}</a>`;
        copyRichText(html, plain);
        flashButton(btn, true);
      }
    });

    anchor.appendChild(btn);
  }

  // Remove "[OUT-9113] " prefix from title so it's not duplicated in output
  function stripBracketedKey(title) {
    return title.replace(/^\[[A-Z]+-\d+\]\s*/, "").trim();
  }

  // ── GitHub ──────────────────────────────────────────────────────────────────

  const GH_BUTTON_ID = "jqc-gh-btn";

  function getGitHubPRData() {
    const urlMatch = location.pathname.match(/\/pull\/(\d+)/);
    if (!urlMatch) return null;
    const prNumber = urlMatch[1];

    const titleEl =
      document.querySelector(".prc-PageHeader-Title-p0Mgh") ||
      document.querySelector(".js-issue-title") ||
      document.querySelector('[data-testid="issue-title"]') ||
      document.querySelector("h1 bdi");

    const fullTitle = titleEl ? titleEl.textContent.trim() : null;
    if (!fullTitle) return null;

    const jiraMatch = fullTitle.match(/\[([A-Z]+-\d+)\]/);
    const jiraKey = jiraMatch ? jiraMatch[1] : null;

    const prUrl = `${location.origin}${location.pathname.replace(/\/pull\/(\d+).*/, "/pull/$1")}`;

    const sizeIcon = getGitHubPRSizeIcon();

    return { prNumber, fullTitle, jiraKey, prUrl, sizeIcon };
  }

  function getGitHubPRSizeIcon() {
    // GitHub shows file count in the "Files changed" tab
    const badge = document.querySelector("#prs-files-anchor-tab");
    if (badge) {
      const m = badge.textContent.match(/\((\d+)\)/);
      const count = m ? parseInt(m[1], 10) : NaN;
      if (!isNaN(count)) {
        if (count === 1)  return ":baby:";
        if (count <= 3)   return ":shrimp:";
        if (count <= 6)   return ":fish:";
        return ":whale:";
      }
    }
    return ":fish:";
  }

  function injectGitHubButton() {
    if (document.getElementById(GH_BUTTON_ID)) return;
    const data = getGitHubPRData();
    if (!data) return;

    // Find the h1 title element
    const h1El = document.querySelector(".prc-PageHeader-Title-p0Mgh") ||
      document.querySelector("h1");

    if (!h1El) return;

    const btn = makeButton(GH_BUTTON_ID, "Copy", "Copy PR title as a formatted link");
    btn.className = "jqc-board-btn";
    btn.style.marginLeft = "8px";

    btn.addEventListener("click", () => {
      const { fullTitle, jiraKey, prUrl, sizeIcon } = getGitHubPRData();
      console.log("JQC: Copy clicked - fullTitle:", fullTitle, "jiraKey:", jiraKey);
      if (!fullTitle) { flashButton(btn, false); return; }

      if (jiraKey) {
        getJiraBase((jiraBase) => {
          console.log("JQC: jiraBase:", jiraBase);
          const jiraUrl = jiraBase ? `https://${jiraBase}/browse/${jiraKey}` : null;
          const plain = `:salesforce: ${sizeIcon} [${jiraKey}] ${stripBracketedKey(fullTitle)} ${prUrl}`;
          const linkedKey = jiraUrl ? `<a href="${jiraUrl}">${jiraKey}</a>` : jiraKey;
          const html = `:salesforce: ${sizeIcon} [${linkedKey}] ${stripBracketedKey(fullTitle)} ${prUrl}`;
          copyRichText(html, plain);
          flashButton(btn, true);
        });
      } else {
        console.log("JQC: No jiraKey found, copying title only");
        const plain = `${fullTitle} ${prUrl}`;
        const html  = `${fullTitle} <a href="${prUrl}">${prUrl}</a>`;
        copyRichText(html, plain);
        flashButton(btn, true);
      }
    });

    // Insert button inside h1 at the end
    h1El.appendChild(btn);
  }

  // ── GitHub PR List ──────────────────────────────────────────────────────────

  function isGitHubPRListView() {
    // Check if on a page that lists multiple PRs
    return location.pathname.includes("/pulls") && !location.pathname.includes("/pull/");
  }

  function getGitHubPRsFromList() {
    // Find all PR items in the list
    const prItems = document.querySelectorAll(
      '[data-testid="issue-row-container"],' +
      'div[role="listitem"],' +
      '[class*="IssueRow"]'
    );
    return prItems;
  }

  function getGitHubPRKeyFromItem(item) {
    // Find PR number and title
    const link = item.querySelector('a[href*="/pull/"]');
    if (!link) return null;

    const match = link.href.match(/\/pull\/(\d+)/);
    return match ? match[1] : null;
  }

  function injectGitHubPRListButtons() {
    if (!isGitHubPRListView()) return;

    const prItems = getGitHubPRsFromList();

    prItems.forEach((item, idx) => {
      const prNum = getGitHubPRKeyFromItem(item);
      if (!prNum) return;

      const btnId = `jqc-gh-list-btn-${prNum}`;
      if (document.getElementById(btnId)) return;

      const link = item.querySelector('a[href*="/pull/"]');
      const title = link ? link.textContent.trim() : "";

      const btn = makeButton(btnId, "Copy", "Copy PR title");
      btn.className = "jqc-board-btn";

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();

        const prLink = item.querySelector('a[href*="/pull/"]');
        if (!prLink) { flashButton(btn, false); return; }

        const prUrl = prLink.href.split("?")[0]; // Remove query params
        const prTitle = prLink.textContent.trim();
        const plain = `${prTitle} ${prUrl}`;
        const html = `${prTitle} <a href="${prUrl}">${prUrl}</a>`;
        copyRichText(html, plain);
        flashButton(btn, true);
      });

      item.appendChild(btn);
    });
  }

  // ── Jira Board ──────────────────────────────────────────────────────────────

  function isBoardView() {
    // Only true if on board page, not on individual issue page or issue popup
    const hasBoard = location.pathname.includes("/boards/");
    const hasIndividualIssue = location.pathname.includes("/browse/");
    const hasSelectedIssue = location.search.includes("selectedIssue=");
    return hasBoard && !hasIndividualIssue && !hasSelectedIssue;
  }

  function getIssuesFromBoard() {
    // Get all links that point to /browse/ (issue pages)
    const issueLinks = document.querySelectorAll('a[href*="/browse/"]');
    const seenKeys = new Set();
    const cards = [];

    issueLinks.forEach((link) => {
      const match = link.href.match(/\/browse\/([A-Z]+-\d+)/);
      if (match) {
        const key = match[1];
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          // Find the closest parent container that represents the card
          let card = link.closest('[role="button"]') ||
                     link.closest('[data-testid]') ||
                     link.closest('[class*="card"]') ||
                     link.closest('[class*="Card"]') ||
                     link.parentElement;

          if (card && !cards.includes(card)) {
            cards.push(card);
          }
        }
      }
    });

    return cards;
  }

  function getIssueKeyFromCard(card) {
    // Try to find issue key in the card
    let issueKey = null;

    // Method 1: Look for link to /browse/
    const browseLink = card.querySelector('a[href*="/browse/"]');
    if (browseLink) {
      const match = browseLink.href.match(/\/browse\/([A-Z]+-\d+)/);
      if (match) return match[1];
    }

    // Method 2: Look for data attributes
    const keyEl = card.querySelector('[data-testid*="key"]');
    if (keyEl) {
      const match = keyEl.textContent.match(/([A-Z]+-\d+)/);
      if (match) return match[1];
    }

    // Method 3: Search in card's text content
    const text = card.textContent;
    const match = text.match(/^([A-Z]+-\d+)/);
    if (match) return match[1];

    return null;
  }

  function injectBoardButtons() {
    if (!isBoardView()) return;

    const cards = getIssuesFromBoard();

    cards.forEach((card, idx) => {
      const issueKey = getIssueKeyFromCard(card);
      if (!issueKey) return;

      // Check if button already exists
      const btnId = `jqc-board-btn-${issueKey}`;
      if (document.getElementById(btnId)) return;

      // Extract title BEFORE adding button to card
      let title = issueKey;
      const contentSection = card.querySelector('[data-component-selector="platform-card.ui.card.card-content.content-section"]');
      if (contentSection) {
        const titleEl = contentSection.querySelector('[data-testid*="single-line-text"]') ||
                       contentSection.querySelector('span');
        if (titleEl) {
          const titleText = titleEl.textContent.trim();
          if (titleText && titleText !== issueKey && titleText.length > issueKey.length) {
            title = titleText;
          }
        }
      }

      const btn = makeButton(btnId, "Copy", "Copy issue key + title");
      btn.className = "jqc-board-btn";
      btn.setAttribute('data-title', title);

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();

        const key = getIssueKeyFromCard(card);
        if (!key) { flashButton(btn, false); return; }

        const storedTitle = btn.getAttribute('data-title') || key;
        const issueUrl = `${location.origin}/browse/${key}`;
        const plain = `${key} ${storedTitle}`;
        const html = `<a href="${issueUrl}">${key}</a> ${storedTitle}`;
        copyRichText(html, plain);
        flashButton(btn, true);
      });

      // Find the priority icon container and insert button next to it
      const priorityContainer = card.querySelector('[data-testid="platform-card.common.ui.priority.icon"]');

      if (priorityContainer) {
        // Insert button right after priority icon
        priorityContainer.parentElement.insertBefore(btn, priorityContainer.nextSibling);
      } else {
        // Fallback: insert at the beginning of the card
        card.insertBefore(btn, card.firstChild);
      }
    });
  }

  // ── Init ────────────────────────────────────────────────────────────────────

  function isJira() {
    return location.hostname.endsWith(".atlassian.net");
  }

  function isBitbucket() {
    return location.hostname.endsWith(".bitbucket.org") || location.hostname === "bitbucket.org";
  }

  function isGitHub() {
    return location.hostname === "github.com" || location.hostname.endsWith(".github.com");
  }

  function inject() {
    if (isJira()) {
      injectJiraButton();
      injectBoardButtons();
    }
    else if (isBitbucket()) {
      injectBitbucketButton();
    }
    else if (isGitHub()) {
      injectGitHubButton();
      injectGitHubPRListButtons();
    }
  }

  const observer = new MutationObserver(() => inject());
  observer.observe(document.body, { childList: true, subtree: true });

  inject();
})();
