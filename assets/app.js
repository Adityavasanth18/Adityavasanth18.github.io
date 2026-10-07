// These are explanatory states, not live project executions.
window.EXPLORER_STATES = {
  apeironcode: {
    workflow: {
      title: "A change is a workflow, not a single answer.",
      description:
        "Project context informs the plan. Tool operations pass through permissions, changes stay inspectable, and review precedes the final apply. The specialist team workflow runs sequentially.",
      status: "WORKFLOW",
      details: [
        "Context + intent",
        "Policy + approval",
        "Worktree or copy",
        "Inspect the diff",
      ],
      active: [0, 1, 2, 3],
    },
    control: {
      title: "The model can propose. The policy decides.",
      description:
        "Filesystem, shell, Git, and network operations have explicit permission boundaries. A denied operation stops at that boundary; it is not a reason to route around the policy.",
      status: "PERMISSION BOUNDARY",
      details: [
        "Proposed action",
        "Denied by policy",
        "Not executed",
        "No change to apply",
      ],
      active: [1],
      dim: [2, 3],
      warning: [1],
    },
    recovery: {
      title: "Keep the workspace. Inspect what happened.",
      description:
        "Isolated workspaces, retained artifacts, and merge review give a failed or interrupted task something concrete to inspect. Worktree cleanup is explicit. Do not assume every external side effect can be rolled back.",
      status: "REVIEWABLE STATE",
      details: [
        "Recorded task",
        "Scoped operations",
        "Retained artifacts",
        "Review before apply",
      ],
      active: [2, 3],
    },
  },
  asterdb: {
    sync: {
      title: "Acknowledge after the WAL sync completes.",
      description:
        "Each logical batch waits for its WAL fsync before becoming visible. Ordered application preserves a contiguous snapshot boundary even when concurrent writers complete their durability steps at different times.",
      status: "DURABLE BARRIER",
      details: [
        "Reserve range",
        "Append record",
        "fsync per batch",
        "Apply in order",
      ],
      active: [2, 3],
    },
    batched: {
      title: "Share a barrier. Keep the ordering.",
      description:
        "Concurrent writers join a bounded group-commit queue. A dedicated worker appends the group and performs one fsync. Each writer waits for that shared barrier; grouping reduces sync calls but may add queueing latency.",
      status: "GROUP COMMIT",
      details: [
        "Concurrent ranges",
        "Queue + append",
        "One fsync / group",
        "Apply in order",
      ],
      active: [1, 2],
    },
    nosync: {
      title: "An acknowledgment is not a power-loss guarantee.",
      description:
        "NoSync writes the record to the WAL without waiting for fsync before acknowledgment. It is a different durability contract, not a free performance optimization. A sudden power loss can lose acknowledged work.",
      status: "WEAKER DURABILITY",
      details: [
        "Reserve range",
        "OS write",
        "No sync barrier",
        "Power-loss risk",
      ],
      active: [1, 3],
      dim: [2],
      warning: [3],
    },
  },
  "agentops-studio": {
    normal: {
      title: "A bounded run with a visible trail.",
      description:
        "The runtime limits steps and duration, validates tool arguments and access, and persists stage checkpoints. Traces connect model calls, tool execution, and the resulting state.",
      status: "ILLUSTRATIVE RUN",
      details: [
        "Bounded request",
        "Schema + allow-list",
        "Timeout enforced",
        "Stage persisted",
      ],
      active: [0, 1, 2, 3],
    },
    retry: {
      title: "Retry the transient failure, within a limit.",
      description:
        "Transient and timeout classes can receive bounded retries with backoff. Validation or permission errors do not become healthier through repetition. The trace preserves the retry sequence.",
      status: "BOUNDED RETRY",
      details: [
        "Model result",
        "Arguments valid",
        "Retry + backoff",
        "Record outcome",
      ],
      active: [2, 3],
      warning: [2],
    },
    timeout: {
      title: "Stop the run. Keep the explanation.",
      description:
        "Run and stage limits prevent unbounded execution. The terminal status and trace preserve what failed. A stage checkpoint can bound lost work; it does not promise exactly-once external side effects.",
      status: "TIMEOUT PATH",
      details: [
        "Deadline bounded",
        "Validated access",
        "Deadline exceeded",
        "Terminal state",
      ],
      active: [2, 3],
      warning: [2],
    },
  },
};

(() => {
  "use strict";

  const toggle = document.querySelector(".menu-toggle");
  const navigation = document.getElementById("main-navigation");
  const setMenu = (open) => {
    if (!toggle || !navigation) return;
    toggle.setAttribute("aria-expanded", String(open));
    navigation.classList.toggle("open", open);
  };
  toggle?.addEventListener("click", () =>
    setMenu(toggle.getAttribute("aria-expanded") !== "true"),
  );
  navigation
    ?.querySelectorAll("a")
    .forEach((link) => link.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      toggle?.getAttribute("aria-expanded") === "true"
    ) {
      setMenu(false);
      toggle.focus();
    }
  });
  document.addEventListener("click", (event) => {
    if (
      navigation &&
      toggle &&
      !navigation.contains(event.target) &&
      !toggle.contains(event.target)
    )
      setMenu(false);
  });

  document.querySelectorAll("[data-explorer]").forEach((explorer) => {
    const states = window.EXPLORER_STATES?.[explorer.dataset.explorer];
    if (!states) return;
    const tabs = [...explorer.querySelectorAll('[role="tab"]')];
    const nodes = [...explorer.querySelectorAll(".flow-node")];
    const panel = explorer.querySelector('[role="tabpanel"]');

    const select = (tab, focus = false) => {
      const state = states[tab.dataset.mode];
      if (!state) return;
      tabs.forEach((item) => {
        const selected = item === tab;
        item.setAttribute("aria-selected", String(selected));
        item.tabIndex = selected ? 0 : -1;
      });
      panel.setAttribute("aria-labelledby", tab.id);
      explorer.querySelector(".explorer-title").textContent = state.title;
      explorer.querySelector(".explorer-description").textContent =
        state.description;
      explorer.querySelector(".explorer-state").textContent = state.status;
      nodes.forEach((node, index) => {
        node.classList.toggle("active", (state.active || []).includes(index));
        node.classList.toggle("dim", (state.dim || []).includes(index));
        node.classList.toggle("warning", (state.warning || []).includes(index));
        node.querySelector(".node-detail").textContent = state.details[index];
      });
      if (focus) tab.focus();
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => select(tab));
      tab.addEventListener("keydown", (event) => {
        let next;
        if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
        if (event.key === "ArrowLeft")
          next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = tabs.length - 1;
        if (next !== undefined) {
          event.preventDefault();
          select(tabs[next], true);
        }
      });
    });
    select(tabs[0]);
  });

  let toastTimer;
  const announce = (message) => {
    const toast = document.querySelector(".toast");
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("visible");
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 5000);
  };
  document.querySelectorAll(".copy-email").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.email);
        announce("Email address copied.");
      } catch {
        announce(button.dataset.email);
        // If clipboard permission is unavailable, show a selectable address.
        button.textContent = button.dataset.email;
        button.style.userSelect = "text";
        button.style.overflowWrap = "anywhere";
      }
    });
  });

  const sectionLinks = [...document.querySelectorAll(".case-sidebar a")];
  if (sectionLinks.length && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          sectionLinks.forEach((link) => {
            if (link.hash === "#" + entry.target.id)
              link.setAttribute("aria-current", "location");
            else link.removeAttribute("aria-current");
          });
        });
      },
      { rootMargin: "-15% 0px -60% 0px", threshold: 0 },
    );
    sectionLinks.forEach((link) => {
      const section = document.querySelector(link.hash);
      if (section) observer.observe(section);
    });
  }
})();

(() => {
  const rows = [...document.querySelectorAll(".collection-row")];
  if (!rows.length) return;
  const filters = [...document.querySelectorAll("[data-filter]")];
  const search = document.getElementById("project-search");
  const count = document.getElementById("project-count");
  const empty = document.getElementById("project-empty");
  const reset = document.getElementById("reset-projects");
  let category = "all";

  function applyFilters() {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    rows.forEach((row) => {
      const matchesCategory =
        category === "all" || row.dataset.category === category;
      const matchesQuery = row.dataset.search.toLowerCase().includes(query);
      row.hidden = !(matchesCategory && matchesQuery);
      if (!row.hidden) visible++;
    });
    filters.forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.filter === category),
      ),
    );
    count.textContent = `${visible} ${visible === 1 ? "project" : "projects"}`;
    empty.hidden = visible !== 0;
    reset.hidden = category === "all" && !query;
  }
  filters.forEach((button) =>
    button.addEventListener("click", () => {
      category = button.dataset.filter;
      applyFilters();
    }),
  );
  search.addEventListener("input", applyFilters);
  reset.addEventListener("click", () => {
    category = "all";
    search.value = "";
    applyFilters();
    search.focus();
  });

  // The radial index and the list always address the same project.
  function openProject(hash) {
    if (!hash.startsWith("#project-")) return;
    const row = document.getElementById(hash.slice(1));
    if (!row || !row.classList.contains("collection-row")) return;
    category = "all";
    search.value = "";
    applyFilters();
    row.open = true;
  }
  window.addEventListener("hashchange", () =>
    openProject(window.location.hash),
  );
  document.querySelectorAll('a[href^="#project-"]').forEach((link) => {
    link.addEventListener("click", () =>
      openProject(link.getAttribute("href")),
    );
  });
  openProject(window.location.hash);

  const nodes = [...document.querySelectorAll("[data-project-select]")];
  const title = document.querySelector(".atlas-project");
  const field = document.querySelector(".atlas-field");
  const link = document.querySelector(".atlas-open");
  function selectProject(button, focus = false) {
    nodes.forEach((node) => {
      const selected = node === button;
      node.classList.toggle("selected", selected);
      node.setAttribute("aria-pressed", String(selected));
      node.tabIndex = selected ? 0 : -1;
    });
    const index = nodes.indexOf(button);
    const ray = document.querySelector(".atlas-focus-ray");
    const position = document.querySelector(".atlas-count");
    if (ray) ray.style.transform = `rotate(${index * 18}deg)`;
    if (position) position.textContent = `${String(index + 1).padStart(2, "0")} / ${nodes.length}`;
    title.textContent = button.dataset.name;
    field.textContent = button.dataset.field;
    link.setAttribute("href", `#project-${button.dataset.projectSelect}`);
    link.setAttribute("aria-label", `Look closer at ${button.dataset.name}`);
    if (focus) button.focus();
  }
  nodes.forEach((button, index) => {
    button.addEventListener("click", () => selectProject(button));
    button.addEventListener("keydown", (event) => {
      let next;
      if (event.key === "ArrowRight" || event.key === "ArrowDown")
        next = (index + 1) % nodes.length;
      if (event.key === "ArrowLeft" || event.key === "ArrowUp")
        next = (index - 1 + nodes.length) % nodes.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = nodes.length - 1;
      if (next !== undefined) {
        event.preventDefault();
        selectProject(nodes[next], true);
      }
    });
  });
})();
