(() => {
  "use strict";
  const categories = [
    { name: "Food", icon: "🍽️", color: "#f29c72" },
    { name: "Transport", icon: "🚆", color: "#6689e8" },
    { name: "Utilities", icon: "💡", color: "#e5ba54" },
    { name: "Entertainment", icon: "🎬", color: "#a77be6" },
    { name: "Rent", icon: "🏠", color: "#4cb9a0" },
    { name: "Shopping", icon: "🛍️", color: "#e47ba0" },
    { name: "Health", icon: "🩺", color: "#55a8cc" },
    { name: "Other", icon: "✦", color: "#9b9eaa" },
  ];
  const keys = {
    transactions: "moneta.transactions.v1",
    budgets: "moneta.budgets.v1",
    theme: "moneta.theme.v1",
  };
  const $ = (id) => document.getElementById(id);
  const today = new Date();
  const localDate = (date) =>
    new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
  const todayString = localDate(today),
    monthString = todayString.slice(0, 7);
  let transactions = load(keys.transactions, []),
    budgets = load(keys.budgets, {}),
    selectedMonth = monthString,
    toastTimer;
  function load(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value === null ? fallback : value;
    } catch (error) {
      console.error(`Unable to load ${key} from local storage.`, error);
      return fallback;
    }
  }
  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Unable to save ${key} to local storage.`, error);
      showToast("Could not save your changes. Check device storage.");
      throw error;
    }
  }
  function money(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);
  }
  function esc(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  }
  function getCategory(name) {
    return (
      categories.find((item) => item.name === name) ||
      categories[categories.length - 1]
    );
  }
  function monthList() {
    return transactions.filter(
      (item) => item.date?.slice(0, 7) === selectedMonth,
    );
  }
  function expenses(list = monthList()) {
    return list.filter((item) => item.type !== "income");
  }
  function incomes(list = monthList()) {
    return list.filter((item) => item.type === "income");
  }
  function sum(list) {
    return list.reduce((total, item) => total + Number(item.amount || 0), 0);
  }
  function spent(name, list = monthList()) {
    return sum(expenses(list).filter((item) => item.category === name));
  }
  function budget(name) {
    return Math.max(0, Number(budgets[name]) || 0);
  }
  function monthName(month) {
    const [year, num] = month.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(new Date(year, num - 1, 1));
  }
  function showToast(message) {
    $("toast").textContent = message;
    $("toast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2600);
  }
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(keys.theme, JSON.stringify(theme));
    } catch (error) {
      console.error("Unable to persist theme preference.", error);
    }
    $("theme-icon").innerHTML =
      theme === "dark"
        ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>'
        : '<path d="M20.2 15.4A8.8 8.8 0 0 1 8.6 3.8 8.9 8.9 0 1 0 20.2 15.4Z"/>';
    $("theme-toggle").setAttribute(
      "aria-label",
      `Switch to ${theme === "dark" ? "light" : "dark"} mode`,
    );
  }
  function setPage(page) {
    document
      .querySelectorAll(".page")
      .forEach((section) =>
        section.classList.toggle("active", section.id === `page-${page}`),
      );
    document
      .querySelectorAll(".nav-item[data-page]")
      .forEach((button) =>
        button.classList.toggle("active", button.dataset.page === page),
      );
    $("page-title").textContent = {
      dashboard: "Overview",
      transactions: "Transactions",
      reports: "Reports",
      budgets: "Budgets",
    }[page];
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function renderSummary() {
    const list = monthList(),
      out = sum(expenses(list)),
      income = sum(incomes(list)),
      limit = categories.reduce((total, item) => total + budget(item.name), 0),
      left = limit - out,
      balance = income - out;
    $("spent-total").textContent = money(out);
    $("spent-note").textContent =
      `${expenses(list).length} expense${expenses(list).length === 1 ? "" : "s"} recorded`;
    $("remaining-total").textContent = money(left);
    $("remaining-note").textContent = limit
      ? `${money(limit)} total category budgets`
      : "Set category budgets to get started";
    $("remaining-note").className =
      `summary-note${left < 0 ? " negative" : ""}`;
    $("balance-total").textContent = money(balance);
    $("balance-note").textContent =
      `${money(income)} income · ${money(out)} expenses`;
    $("balance-note").className =
      `summary-note${balance > 0 ? " positive" : balance < 0 ? " negative" : ""}`;
  }
  function renderDonut() {
    const values = categories
        .map((item) => ({ ...item, amount: spent(item.name) }))
        .filter((item) => item.amount > 0),
      total = values.reduce((s, item) => s + item.amount, 0),
      circ = 2 * Math.PI * 48;
    let offset = 0;
    const segments = values
      .map((item) => {
        const length = total ? (circ * item.amount) / total : 0,
          html = `<circle class="donut-segment" cx="60" cy="60" r="48" stroke="${item.color}" stroke-dasharray="${length} ${circ - length}" stroke-dashoffset="${-offset}"/>`;
        offset += length;
        return html;
      })
      .join("");
    const legend = values
      .slice()
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4)
      .map(
        (item) =>
          `<div class="legend-row"><i class="dot" style="background:${item.color}"></i><span>${esc(item.name)}</span><b>${Math.round((item.amount / total) * 100)}%</b></div>`,
      )
      .join("");
    $("donut-container").innerHTML =
      `<div class="donut-wrap"><div class="donut"><svg viewBox="0 0 120 120" role="img" aria-label="Spending by category"><circle class="donut-track" cx="60" cy="60" r="48"/>${segments}</svg><div class="donut-center"><strong>${money(total)}</strong><span>total spent</span></div></div><div class="legend">${legend || '<div class="legend-row">No spending yet</div>'}</div></div>`;
  }
  function renderBars() {
    const values = categories
      .map((item) => ({
        ...item,
        actual: spent(item.name),
        limit: budget(item.name),
      }))
      .filter((item) => item.actual || item.limit);
    if (!values.length) {
      $("bar-container").innerHTML =
        '<div class="empty-state">Set category budgets to compare your planned and actual spending.</div>';
      return;
    }
    const max = Math.max(
      ...values.flatMap((item) => [item.actual, item.limit]),
      1,
    );
    $("bar-container").innerHTML =
      `<div class="bar-chart">${values.map((item) => `<div class="bar-row"><span class="bar-label">${item.icon} ${esc(item.name)}</span><div class="bar-pair"><div class="bar-track" title="Spent ${money(item.actual)}"><div class="bar-fill" style="width:${Math.min(100, (item.actual / max) * 100)}%"></div></div><div class="bar-track" title="Budget ${money(item.limit)}"><div class="bar-fill budget" style="width:${Math.min(100, (item.limit / max) * 100)}%"></div></div></div><span class="bar-values">${money(item.actual)}</span></div>`).join("")}</div>`;
  }
  function budgetState(name) {
    const limit = budget(name),
      actual = spent(name),
      ratio = limit ? actual / limit : actual ? 1 : 0;
    return {
      limit,
      actual,
      ratio,
      pct: Math.min(100, ratio * 100),
      state:
        !limit && !actual
          ? "none"
          : ratio >= 1
            ? "over"
            : ratio >= 0.8
              ? "warning"
              : "ok",
    };
  }
  function budgetRow(item, status) {
    const caption = status.limit
      ? `${Math.round(status.ratio * 100)}% used · ${status.ratio >= 1 ? `${money(status.actual - status.limit)} over limit` : `${money(status.limit - status.actual)} left`}`
      : "No limit set";
    return `<div class="budget-row"><div class="category-name"><span class="symbol">${item.icon}</span><span>${esc(item.name)}<span class="budget-caption">${caption}</span></span></div><div class="progress" role="progressbar" aria-label="${esc(item.name)} budget used" aria-valuenow="${Math.round(status.pct)}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill ${status.state === "warning" ? "warning" : status.state === "over" ? "over" : ""}" style="width:${status.pct}%"></div></div><div class="budget-numbers"><strong>${money(status.actual)}</strong><span>/ ${status.limit ? money(status.limit) : "—"}</span></div></div>`;
  }
  function renderBudgets() {
    $("dashboard-budgets").innerHTML = categories
      .map((item) => budgetRow(item, budgetState(item.name)))
      .join("");
    $("settings-budget-progress").innerHTML = $("dashboard-budgets").innerHTML;
  }
  function table(list) {
    if (!list.length)
      return '<div class="empty-state"><strong>No transactions to show</strong>When you add a transaction, it will appear here.</div>';
    const sorted = list
      .slice()
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          String(b.id).localeCompare(String(a.id)),
      );
    return `<table><thead><tr><th>Date</th><th>Transaction</th><th>Category</th><th>Amount</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${sorted
      .map((item) => {
        const type = item.type === "income" ? "income" : "expense",
          cat = getCategory(item.category),
          symbol = type === "income" ? "↗" : cat.icon;
        return `<tr><td>${esc(new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${item.date}T12:00:00`)))}</td><td><div class="merchant-cell"><span class="symbol">${symbol}</span><span><span class="merchant-name">${esc(item.merchant)}</span>${item.notes ? `<span class="merchant-note">${esc(item.notes)}</span>` : ""}</span></div></td><td><span class="pill ${type}">${type === "income" ? "Income" : esc(item.category)}</span></td><td class="amount ${type}">${type === "income" ? "+" : "−"}${money(item.amount)}</td><td><div class="row-actions"><button class="tiny-button" data-edit="${esc(item.id)}" aria-label="Edit ${esc(item.merchant)}" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m14 5 5 5M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16z"/></svg></button><button class="tiny-button delete" data-delete="${esc(item.id)}" aria-label="Delete ${esc(item.merchant)}" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3"/></svg></button></div></td></tr>`;
      })
      .join("")}</tbody></table>`;
  }
  function renderTransactions() {
    const recent = monthList()
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
    $("recent-transactions").innerHTML = table(recent);
    const q = $("merchant-filter").value.trim().toLowerCase(),
      from = $("date-from").value,
      to = $("date-to").value,
      cat = $("category-filter").value,
      type = $("type-filter").value;
    const filtered = transactions.filter(
      (item) =>
        (!q ||
          `${item.merchant} ${item.notes || ""}`.toLowerCase().includes(q)) &&
        (!from || item.date >= from) &&
        (!to || item.date <= to) &&
        (!cat || item.category === cat) &&
        (!type || (item.type === "income" ? "income" : "expense") === type),
    );
    $("all-transactions").innerHTML = table(filtered);
  }
  function renderDaily() {
    const [year, month] = selectedMonth.split("-").map(Number),
      days = new Date(year, month, 0).getDate(),
      daily = Array(days).fill(0);
    expenses().forEach((item) => {
      const day = Number(item.date.slice(-2));
      if (day > 0 && day <= days) daily[day - 1] += Number(item.amount);
    });
    const max = Math.max(...daily, 1),
      left = 38,
      right = 740,
      top = 14,
      bottom = 175,
      points = daily.map((amount, index) => ({
        x: left + (days === 1 ? 0 : (index * (right - left)) / (days - 1)),
        y: bottom - (amount / max) * (bottom - top),
        amount,
      }));
    const path = points
        .map(
          (point, index) =>
            `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
        )
        .join(" "),
      area = `${path} L${right} ${bottom} L${left} ${bottom} Z`;
    const ticks = [0, 0.5, 1]
      .map((f) => {
        const y = bottom - f * (bottom - top);
        return `<line class="grid-line" x1="${left}" y1="${y}" x2="${right}" y2="${y}"/><text x="0" y="${y + 3}">${money(max * f)}</text>`;
      })
      .join("");
    const labels = [
      ...new Set([
        1,
        Math.ceil(days / 4),
        Math.ceil(days / 2),
        Math.ceil(days * 0.75),
        days,
      ]),
    ]
      .map((day) => {
        const x =
          left + (days === 1 ? 0 : ((day - 1) * (right - left)) / (days - 1));
        return `<text x="${x}" y="198" text-anchor="middle">${day}</text>`;
      })
      .join("");
    $("daily-chart").innerHTML =
      `<svg class="line-chart" viewBox="0 0 760 210" role="img" aria-label="Daily spending for ${esc(monthName(selectedMonth))}">${ticks}<path class="trend-area" d="${area}"/><path class="trend-line" d="${path}"/>${points.map((point, index) => (point.amount > 0 ? `<circle class="trend-point" cx="${point.x}" cy="${point.y}" r="3"><title>Day ${index + 1}: ${money(point.amount)}</title></circle>` : "")).join("")}${labels}</svg>`;
  }
  function renderReport() {
    const list = monthList(),
      income = sum(incomes(list)),
      out = sum(expenses(list));
    $("report-subtitle").textContent =
      `Income, spending, and budget progress for ${monthName(selectedMonth)}.`;
    $("report-income").textContent = money(income);
    $("report-expenses").textContent = money(out);
    const totalBudget = categories.reduce(
      (v, item) => v + budget(item.name),
      0,
    );
    $("report-table").innerHTML =
      `<table><thead><tr><th>Category</th><th>Budgeted</th><th>Actual</th><th>Difference</th><th>Status</th></tr></thead><tbody>${categories
        .map((item) => {
          const limit = budget(item.name),
            actual = spent(item.name),
            diff = limit - actual,
            over = diff < 0;
          return `<tr><td>${item.icon} ${esc(item.name)}</td><td>${money(limit)}</td><td>${money(actual)}</td><td style="color:${over ? "var(--red)" : "var(--green)"}">${over ? "−" : "+"}${money(Math.abs(diff))}</td><td><span class="status ${over ? "over" : "ok"}"><i class="status-dot"></i>${over ? "Over budget" : "On track"}</span></td></tr>`;
        })
        .join(
          "",
        )}<tr><td><strong>Total</strong></td><td><strong>${money(totalBudget)}</strong></td><td><strong>${money(out)}</strong></td><td><strong>${money(totalBudget - out)}</strong></td><td>—</td></tr></tbody></table>`;
    const top = categories
      .map((item) => ({ ...item, amount: spent(item.name) }))
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);
    $("top-categories").innerHTML = top.length
      ? top
          .map(
            (item, index) =>
              `<div class="top-item"><span class="rank">${index + 1}</span><span class="symbol">${item.icon}</span><span class="top-name">${esc(item.name)}</span><strong>${money(item.amount)}</strong></div>`,
          )
          .join("")
      : '<div class="empty-state">No spending recorded this month.</div>';
    renderDaily();
  }
  function renderBudgetEditor() {
    $("budget-editor").innerHTML = categories
      .map(
        (item) =>
          `<label class="budget-edit-card"><span class="category-name"><span class="symbol">${item.icon}</span>${esc(item.name)}</span><input type="number" min="0" step="0.01" inputmode="decimal" name="${esc(item.name)}" value="${budget(item.name) || ""}" placeholder="No limit" aria-label="${esc(item.name)} monthly budget"></label>`,
      )
      .join("");
  }
  function renderAll() {
    $("greeting").textContent = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    })
      .format(today)
      .toUpperCase();
    renderSummary();
    renderDonut();
    renderBars();
    renderBudgets();
    renderTransactions();
    renderReport();
    renderBudgetEditor();
  }
  function openTransaction(item) {
    $("transaction-form").reset();
    $("transaction-id").value = item?.id || "";
    $("dialog-title").textContent = item
      ? "Edit transaction"
      : "Add transaction";
    $("transaction-type").value =
      item?.type === "income" ? "income" : "expense";
    $("transaction-date").value = item?.date || todayString;
    $("transaction-amount").value = item?.amount ?? "";
    $("transaction-category").value = item?.category || categories[0].name;
    $("transaction-merchant").value = item?.merchant || "";
    $("transaction-notes").value = item?.notes || "";
    updateCategoryVisibility();
    $("transaction-dialog").showModal();
    $("transaction-merchant").focus();
  }
  function updateCategoryVisibility() {
    const isExpense = $("transaction-type").value === "expense";
    $("category-field").hidden = !isExpense;
    $("transaction-category").required = isExpense;
  }
  function exportCSV() {
    const rows = [
      ["Monthly report", monthName(selectedMonth)],
      ["Total income", sum(incomes())],
      ["Total expenses", sum(expenses())],
      [],
      ["Category", "Budgeted Amount", "Actual Amount", "Difference", "Status"],
    ];
    categories.forEach((item) => {
      const limit = budget(item.name),
        actual = spent(item.name),
        diff = limit - actual;
      rows.push([
        item.name,
        limit.toFixed(2),
        actual.toFixed(2),
        diff.toFixed(2),
        diff < 0 ? "Over budget" : "On track",
      ]);
    });
    const csv = rows
        .map((row) =>
          row
            .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
            .join(","),
        )
        .join("\r\n"),
      url = URL.createObjectURL(
        new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
      );
    const link = document.createElement("a");
    link.href = url;
    link.download = `moneta-report-${selectedMonth}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Monthly report exported.");
  }
  function init() {
    const theme = load(keys.theme, "light");
    setTheme(theme === "dark" ? "dark" : "light");
    $("month-picker").value = selectedMonth;
    $("transaction-category").innerHTML = categories
      .map(
        (item) =>
          `<option value="${esc(item.name)}">${esc(item.name)}</option>`,
      )
      .join("");
    $("category-filter").innerHTML += [
      ...categories.map(
        (item) =>
          `<option value="${esc(item.name)}">${esc(item.name)}</option>`,
      ),
    ].join("");
    document
      .querySelectorAll(".nav-item[data-page]")
      .forEach((button) =>
        button.addEventListener("click", () => setPage(button.dataset.page)),
      );
    document
      .querySelectorAll("[data-go]")
      .forEach((button) =>
        button.addEventListener("click", () => setPage(button.dataset.go)),
      );
    $("theme-toggle").addEventListener("click", () =>
      setTheme(
        document.documentElement.dataset.theme === "dark" ? "light" : "dark",
      ),
    );
    $("month-picker").addEventListener("change", (event) => {
      if (!event.target.value) return;
      selectedMonth = event.target.value;
      renderAll();
    });
    $("add-expense").addEventListener("click", () => openTransaction());
    $("close-dialog").addEventListener("click", () =>
      $("transaction-dialog").close(),
    );
    $("cancel-dialog").addEventListener("click", () =>
      $("transaction-dialog").close(),
    );
    $("transaction-type").addEventListener("change", updateCategoryVisibility);
    [
      "merchant-filter",
      "date-from",
      "date-to",
      "category-filter",
      "type-filter",
    ].forEach((id) => $(id).addEventListener("input", renderTransactions));
    $("transaction-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const amount = Number($("transaction-amount").value),
        merchant = $("transaction-merchant").value.trim();
      if (!Number.isFinite(amount) || amount <= 0 || !merchant) return;
      const id = $("transaction-id").value,
        type = $("transaction-type").value,
        record = {
          id:
            id ||
            (crypto.randomUUID
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`),
          type,
          date: $("transaction-date").value,
          amount: Math.round(amount * 100) / 100,
          category:
            type === "income" ? "Income" : $("transaction-category").value,
          merchant,
          notes: $("transaction-notes").value.trim(),
        };
      const next = id
        ? transactions.map((item) => (item.id === id ? record : item))
        : [...transactions, record];
      save(keys.transactions, next);
      transactions = next;
      $("transaction-dialog").close();
      renderAll();
      showToast(id ? "Transaction updated." : "Transaction saved.");
    });
    document.body.addEventListener("click", (event) => {
      const edit = event.target.closest("[data-edit]");
      if (edit) {
        const item = transactions.find((row) => row.id === edit.dataset.edit);
        if (item) openTransaction(item);
        return;
      }
      const remove = event.target.closest("[data-delete]");
      if (remove) {
        const item = transactions.find(
          (row) => row.id === remove.dataset.delete,
        );
        if (
          item &&
          window.confirm(`Delete “${item.merchant}”? This cannot be undone.`)
        ) {
          const next = transactions.filter((row) => row.id !== item.id);
          save(keys.transactions, next);
          transactions = next;
          renderAll();
          showToast("Transaction deleted.");
        }
      }
    });
    $("budget-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget),
        next = {};
      categories.forEach((item) => {
        const value = Number(form.get(item.name));
        if (Number.isFinite(value) && value > 0)
          next[item.name] = Math.round(value * 100) / 100;
      });
      save(keys.budgets, next);
      budgets = next;
      renderAll();
      showToast("Budget limits saved.");
    });
    $("export-csv").addEventListener("click", exportCSV);
    renderAll();
  }
  init();
})();
