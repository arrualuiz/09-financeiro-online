// Orquestra login, busca de dados, parsing e renderização do dashboard.

(() => {
  const RANGE = `'${window.APP_CONFIG.SHEET_NAME}'!A1:BT210`;

  let state = { months: [], transactions: [] };
  let charts = { category: null, monthly: null };

  const fmtBRL = (n) =>
    (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const fmtDate = (d) => (d ? d.toLocaleDateString("pt-BR") : "—");

  const PALETTE = [
    "#5b9bff", "#3ddc97", "#ff6b6b", "#ffc857", "#b98bff",
    "#4dd0e1", "#ff9770", "#a3e635", "#f472b6", "#94a3b8",
  ];
  const colorCache = new Map();
  function colorFor(label) {
    if (!colorCache.has(label)) {
      colorCache.set(label, PALETTE[colorCache.size % PALETTE.length]);
    }
    return colorCache.get(label);
  }

  function el(id) {
    return document.getElementById(id);
  }

  function showApp() {
    el("login-screen").hidden = true;
    el("app").hidden = false;
  }

  function setLoading(isLoading) {
    el("loading").hidden = !isLoading;
    el("dashboard-content").hidden = isLoading;
  }

  function showLoadError(message) {
    const errEl = el("load-error");
    errEl.textContent = message;
    errEl.hidden = false;
    el("loading").hidden = true;
  }

  function currentMonthKeyGuess() {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const found = Parser.MONTHS.find((m) => m.key === key);
    if (found) return found.key;
    // fallback: último mês que tem alguma transação
    for (let i = Parser.MONTHS.length - 1; i >= 0; i--) {
      const k = Parser.MONTHS[i].key;
      if (state.transactions.some((t) => t.month === k)) return k;
    }
    return Parser.MONTHS[0].key;
  }

  function populateMonthSelect() {
    const sel = el("month-select");
    sel.innerHTML = "";
    for (const m of Parser.MONTHS) {
      const opt = document.createElement("option");
      opt.value = m.key;
      opt.textContent = m.label;
      sel.appendChild(opt);
    }
    sel.value = currentMonthKeyGuess();
  }

  function renderCards(monthKey) {
    const monthTx = state.transactions.filter((t) => t.month === monthKey);
    const income = monthTx.filter((t) => t.type === "income");
    const expenseCore = monthTx.filter((t) => t.type === "expense" && !t.isCardDetail);

    const totalIncome = income.reduce((s, t) => s + t.amount, 0);
    const totalExpense = expenseCore.reduce((s, t) => s + t.amount, 0);
    const pending = expenseCore.filter((t) => !t.paid).reduce((s, t) => s + t.amount, 0);

    el("card-total-income").textContent = fmtBRL(totalIncome);
    el("card-total-expense").textContent = fmtBRL(totalExpense);
    el("card-balance").textContent = fmtBRL(totalIncome - totalExpense);
    el("card-pending").textContent = fmtBRL(pending);
  }

  function renderCategoryChart(monthKey) {
    const expenseCore = state.transactions.filter(
      (t) => t.month === monthKey && t.type === "expense" && !t.isCardDetail
    );
    const byCategory = new Map();
    for (const t of expenseCore) {
      byCategory.set(t.categoria, (byCategory.get(t.categoria) || 0) + t.amount);
    }
    const labels = [...byCategory.keys()];
    const data = [...byCategory.values()];

    if (charts.category) charts.category.destroy();
    charts.category = new Chart(el("chart-category"), {
      type: "doughnut",
      data: {
        labels,
        datasets: [{ data, backgroundColor: labels.map(colorFor) }],
      },
      options: {
        plugins: { legend: { position: "bottom", labels: { color: "#9aa1b2" } } },
      },
    });
  }

  function renderMonthlyChart() {
    const labels = Parser.MONTHS.map((m) => m.label);
    const incomeData = Parser.MONTHS.map((m) =>
      state.transactions
        .filter((t) => t.month === m.key && t.type === "income")
        .reduce((s, t) => s + t.amount, 0)
    );
    const expenseData = Parser.MONTHS.map((m) =>
      state.transactions
        .filter((t) => t.month === m.key && t.type === "expense" && !t.isCardDetail)
        .reduce((s, t) => s + t.amount, 0)
    );

    if (charts.monthly) charts.monthly.destroy();
    charts.monthly = new Chart(el("chart-monthly"), {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Entradas", data: incomeData, backgroundColor: "#3ddc97" },
          { label: "Saídas", data: expenseData, backgroundColor: "#ff6b6b" },
        ],
      },
      options: {
        plugins: { legend: { labels: { color: "#9aa1b2" } } },
        scales: {
          x: { ticks: { color: "#9aa1b2" }, grid: { display: false } },
          y: { ticks: { color: "#9aa1b2" } },
        },
      },
    });
  }

  function renderTables(monthKey) {
    const monthTx = state.transactions
      .filter((t) => t.month === monthKey)
      .sort((a, b) => (a.date && b.date ? a.date - b.date : 0));

    const incomeBody = document.querySelector("#table-income tbody");
    incomeBody.innerHTML = "";
    for (const t of monthTx.filter((t) => t.type === "income")) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${t.descricao}</td><td>${fmtDate(t.date)}</td><td>${fmtBRL(t.amount)}</td><td>${t.paid ? "✅" : "—"}</td>`;
      incomeBody.appendChild(tr);
    }

    const expenseBody = document.querySelector("#table-expense tbody");
    expenseBody.innerHTML = "";
    for (const t of monthTx.filter((t) => t.type === "expense")) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${t.categoria}</td><td>${t.descricao}</td><td>${fmtDate(t.date)}</td><td>${fmtBRL(t.amount)}</td><td>${t.paid ? "✅" : "—"}</td>`;
      expenseBody.appendChild(tr);
    }
  }

  function render(monthKey) {
    renderCards(monthKey);
    renderCategoryChart(monthKey);
    renderMonthlyChart();
    renderTables(monthKey);
  }

  async function loadData() {
    setLoading(true);
    el("load-error").hidden = true;
    try {
      const grid = await SheetsAPI.fetchRange(RANGE);
      state = Parser.parse(grid);
      populateMonthSelect();
      setLoading(false);
      el("dashboard-content").hidden = false;
      render(el("month-select").value);
    } catch (err) {
      if (err.message === "TOKEN_EXPIRED") {
        AUTH.signIn();
        return;
      }
      console.error(err);
      showLoadError("Não foi possível carregar os dados da planilha. Tente atualizar a página.");
    }
  }

  function onSignedIn() {
    showApp();
    loadData();
  }

  document.addEventListener("DOMContentLoaded", () => {
    el("btn-login").addEventListener("click", () => AUTH.signIn());
    el("btn-logout").addEventListener("click", () => AUTH.signOut());
    el("btn-refresh").addEventListener("click", () => loadData());
    el("month-select").addEventListener("change", (e) => render(e.target.value));

    AUTH.init(onSignedIn);
  });
})();
