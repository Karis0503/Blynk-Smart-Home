const STORAGE_KEY = "budget-tracker-pro-v1";
const categories = {
  income: ["Gaji", "Freelance", "Investasi", "Bonus", "Lainnya"],
  expense: ["Makanan", "Transport", "Tagihan", "Hiburan", "Belanja", "Kesehatan", "Lainnya"]
};

const state = loadState();

const el = {
  transactionForm: document.getElementById("transactionForm"),
  title: document.getElementById("title"),
  amount: document.getElementById("amount"),
  type: document.getElementById("type"),
  category: document.getElementById("category"),
  date: document.getElementById("date"),
  account: document.getElementById("account"),
  recurring: document.getElementById("recurring"),
  notes: document.getElementById("notes"),
  transactionTable: document.getElementById("transactionTable"),
  balanceValue: document.getElementById("balanceValue"),
  incomeValue: document.getElementById("incomeValue"),
  expenseValue: document.getElementById("expenseValue"),
  savingRate: document.getElementById("savingRate"),
  budgetForm: document.getElementById("budgetForm"),
  budgetCategory: document.getElementById("budgetCategory"),
  budgetLimit: document.getElementById("budgetLimit"),
  budgetList: document.getElementById("budgetList"),
  goalForm: document.getElementById("goalForm"),
  goalName: document.getElementById("goalName"),
  goalTarget: document.getElementById("goalTarget"),
  goalList: document.getElementById("goalList"),
  goalTemplate: document.getElementById("goalTemplate"),
  monthFilter: document.getElementById("monthFilter"),
  typeFilter: document.getElementById("typeFilter"),
  categoryFilter: document.getElementById("categoryFilter"),
  monthlyChart: document.getElementById("monthlyChart"),
  exportBtn: document.getElementById("exportBtn"),
  importInput: document.getElementById("importInput")
};

init();

function init() {
  const today = new Date().toISOString().slice(0, 10);
  el.date.value = today;

  populateMonthFilter();
  populateCategoryOptions();
  el.transactionForm.addEventListener("submit", onAddTransaction);
  el.type.addEventListener("change", populateCategoryOptions);
  el.monthFilter.addEventListener("change", renderAll);
  el.typeFilter.addEventListener("change", renderAll);
  el.categoryFilter.addEventListener("change", renderAll);
  el.budgetForm.addEventListener("submit", onSetBudget);
  el.goalForm.addEventListener("submit", onAddGoal);
  el.exportBtn.addEventListener("click", onExportData);
  el.importInput.addEventListener("change", onImportData);

  processRecurring();
  renderAll();
}

function onAddTransaction(event) {
  event.preventDefault();
  const transaction = {
    id: crypto.randomUUID(),
    title: el.title.value.trim(),
    amount: Number(el.amount.value),
    type: el.type.value,
    category: el.category.value,
    date: el.date.value,
    account: el.account.value,
    recurring: el.recurring.value,
    notes: el.notes.value.trim()
  };

  state.transactions.unshift(transaction);
  saveState();
  el.transactionForm.reset();
  el.date.value = new Date().toISOString().slice(0, 10);
  populateCategoryOptions();
  renderAll();
}

function onSetBudget(event) {
  event.preventDefault();
  const category = el.budgetCategory.value;
  const limit = Number(el.budgetLimit.value);
  state.budgets[category] = limit;
  saveState();
  el.budgetForm.reset();
  renderAll();
}

function onAddGoal(event) {
  event.preventDefault();
  state.goals.push({
    id: crypto.randomUUID(),
    name: el.goalName.value.trim(),
    target: Number(el.goalTarget.value),
    saved: 0
  });
  saveState();
  el.goalForm.reset();
  renderAll();
}

function onExportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `budget-tracker-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function onImportData(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!parsed.transactions || !parsed.budgets || !parsed.goals) {
        throw new Error("Format file tidak valid");
      }
      state.transactions = parsed.transactions;
      state.budgets = parsed.budgets;
      state.goals = parsed.goals;
      saveState();
      renderAll();
    } catch (error) {
      alert(error.message);
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

function renderAll() {
  renderSummary();
  renderBudgets();
  renderGoals();
  renderTransactions();
  renderChart();
}

function renderSummary() {
  const data = getFilteredTransactions();
  const income = sum(data.filter((t) => t.type === "income").map((t) => t.amount));
  const expense = sum(data.filter((t) => t.type === "expense").map((t) => t.amount));
  const balance = income - expense;
  const savingRate = income > 0 ? ((balance / income) * 100).toFixed(1) : 0;

  el.incomeValue.textContent = formatCurrency(income);
  el.expenseValue.textContent = formatCurrency(expense);
  el.balanceValue.textContent = formatCurrency(balance);
  el.savingRate.textContent = `${savingRate}%`;
}

function renderBudgets() {
  el.budgetCategory.innerHTML = categories.expense
    .map((category) => `<option value="${category}">${category}</option>`)
    .join("");

  const month = el.monthFilter.value;
  const expenseData = state.transactions.filter(
    (t) => t.type === "expense" && t.date.startsWith(month)
  );

  el.budgetList.innerHTML = "";

  Object.entries(state.budgets).forEach(([category, limit]) => {
    const spent = sum(expenseData.filter((t) => t.category === category).map((t) => t.amount));
    const pct = Math.min(100, (spent / limit) * 100 || 0);
    const status = spent > limit ? "Lewat budget" : "Aman";

    const item = document.createElement("div");
    item.className = "budget-item";
    item.innerHTML = `
      <strong>${category}</strong>
      <small>${formatCurrency(spent)} / ${formatCurrency(limit)} (${pct.toFixed(1)}%) - ${status}</small>
      <div class="progress"><div class="progress-bar" style="width:${pct}%;background:${spent > limit ? "var(--danger)" : "var(--accent)"}"></div></div>
    `;
    el.budgetList.appendChild(item);
  });
}

function renderGoals() {
  const totalSaving = Math.max(0, getTotalIncome() - getTotalExpense());
  const goals = [...state.goals];
  const weight = goals.length ? totalSaving / goals.length : 0;

  el.goalList.innerHTML = "";
  goals.forEach((goal) => {
    goal.saved = Math.max(goal.saved, weight);
    const pct = Math.min(100, (goal.saved / goal.target) * 100 || 0);

    const node = el.goalTemplate.content.cloneNode(true);
    node.querySelector(".goal-name").textContent = goal.name;
    node.querySelector(".goal-meta").textContent = `${formatCurrency(goal.saved)} / ${formatCurrency(
      goal.target
    )}`;
    node.querySelector(".progress-bar").style.width = `${pct}%`;
    el.goalList.appendChild(node);
  });

  saveState();
}

function renderTransactions() {
  const data = getFilteredTransactions();

  el.transactionTable.innerHTML = data
    .map(
      (t) => `
      <tr>
        <td>${t.date}</td>
        <td>${t.title}</td>
        <td>${t.category}</td>
        <td>${t.account}</td>
        <td><span class="badge ${t.type}">${t.type === "income" ? "Pemasukan" : "Pengeluaran"}</span></td>
        <td>${formatCurrency(t.amount)}</td>
        <td><button data-id="${t.id}">Hapus</button></td>
      </tr>
    `
    )
    .join("");

  el.transactionTable.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.transactions = state.transactions.filter((t) => t.id !== button.dataset.id);
      saveState();
      renderAll();
    });
  });
}

function renderChart() {
  const ctx = el.monthlyChart.getContext("2d");
  const width = el.monthlyChart.width;
  const height = el.monthlyChart.height;
  ctx.clearRect(0, 0, width, height);

  const grouped = new Map();
  getFilteredTransactions().forEach((t) => {
    if (!grouped.has(t.category)) grouped.set(t.category, 0);
    grouped.set(t.category, grouped.get(t.category) + t.amount);
  });

  const entries = [...grouped.entries()].slice(0, 8);
  if (!entries.length) return;

  const max = Math.max(...entries.map(([, value]) => value));
  const gap = 12;
  const barWidth = (width - gap * (entries.length + 1)) / entries.length;

  entries.forEach(([label, value], i) => {
    const h = (value / max) * (height - 50);
    const x = gap + i * (barWidth + gap);
    const y = height - h - 26;

    ctx.fillStyle = "#22c55e";
    ctx.fillRect(x, y, barWidth, h);
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "12px sans-serif";
    ctx.fillText(label.slice(0, 8), x, height - 8);
  });
}

function populateMonthFilter() {
  const monthSet = new Set();
  state.transactions.forEach((t) => monthSet.add(t.date.slice(0, 7)));
  monthSet.add(new Date().toISOString().slice(0, 7));

  el.monthFilter.innerHTML = [...monthSet]
    .sort()
    .reverse()
    .map((month) => `<option value="${month}">${month}</option>`)
    .join("");

  el.categoryFilter.innerHTML = `<option value="all">Semua Kategori</option>${[
    ...new Set([...categories.income, ...categories.expense])
  ]
    .map((category) => `<option value="${category}">${category}</option>`)
    .join("")}`;
}

function populateCategoryOptions() {
  const selected = categories[el.type.value] || [];
  el.category.innerHTML = selected.map((c) => `<option value="${c}">${c}</option>`).join("");
}

function getFilteredTransactions() {
  const month = el.monthFilter.value;
  const type = el.typeFilter.value;
  const category = el.categoryFilter.value;

  return state.transactions.filter((t) => {
    const matchMonth = month ? t.date.startsWith(month) : true;
    const matchType = type === "all" ? true : t.type === type;
    const matchCategory = category === "all" ? true : t.category === category;
    return matchMonth && matchType && matchCategory;
  });
}

function processRecurring() {
  const today = new Date();
  const lastRun = state.lastRecurringRun ? new Date(state.lastRecurringRun) : null;
  if (lastRun && lastRun.toDateString() === today.toDateString()) return;

  const clones = [];
  state.transactions.forEach((t) => {
    if (t.recurring === "none") return;
    const txDate = new Date(t.date);
    if (t.recurring === "monthly" && txDate.getDate() === today.getDate()) {
      clones.push({ ...t, id: crypto.randomUUID(), date: today.toISOString().slice(0, 10), recurring: "none" });
    }
    if (t.recurring === "weekly" && txDate.getDay() === today.getDay()) {
      clones.push({ ...t, id: crypto.randomUUID(), date: today.toISOString().slice(0, 10), recurring: "none" });
    }
  });

  if (clones.length) state.transactions.unshift(...clones);
  state.lastRecurringRun = today.toISOString();
  saveState();
}

function getTotalIncome() {
  return sum(state.transactions.filter((t) => t.type === "income").map((t) => t.amount));
}

function getTotalExpense() {
  return sum(state.transactions.filter((t) => t.type === "expense").map((t) => t.amount));
}

function sum(values) {
  return values.reduce((acc, value) => acc + value, 0);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
    amount
  );
}

function loadState() {
  const defaultState = {
    transactions: [
      {
        id: crypto.randomUUID(),
        title: "Gaji Bulanan",
        amount: 12000000,
        type: "income",
        category: "Gaji",
        date: new Date().toISOString().slice(0, 10),
        account: "Bank",
        recurring: "monthly",
        notes: ""
      },
      {
        id: crypto.randomUUID(),
        title: "Belanja Mingguan",
        amount: 850000,
        type: "expense",
        category: "Belanja",
        date: new Date().toISOString().slice(0, 10),
        account: "E-Wallet",
        recurring: "weekly",
        notes: ""
      }
    ],
    budgets: { Makanan: 1500000, Transport: 800000, Belanja: 2000000 },
    goals: [{ id: crypto.randomUUID(), name: "Dana Darurat", target: 30000000, saved: 0 }],
    lastRecurringRun: null
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    return { ...defaultState, ...JSON.parse(raw) };
  } catch {
    return defaultState;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  populateMonthFilter();
}
