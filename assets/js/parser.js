// Interpreta o grid bruto da aba "CONTABIL 2026" e transforma em transações.
//
// Layout da planilha (mapeado manualmente, veja README.md > "Como funciona o parser"):
// - Colunas B/C = Categoria / Descrição (ou "Entrada"/"Total" para linhas de receita)
// - A partir da coluna I, cada mês ocupa 4 colunas: [Quando?, Quanto?, Pago?, (vazia)]
// - 14 meses: dezembro/2025 até janeiro/2027, começando na coluna I (índice 9), passo 4.
// - Algumas linhas são subtotais já calculados pela planilha (ex: "Soma de Boletos") —
//   elas precisam ser ignoradas, senão os valores entram em dobro no total.

const Parser = (() => {
  const MONTHS = [
    { key: "2025-12", label: "dezembro/2025", colBase: 9 },
    { key: "2026-01", label: "janeiro/2026", colBase: 13 },
    { key: "2026-02", label: "fevereiro/2026", colBase: 17 },
    { key: "2026-03", label: "março/2026", colBase: 21 },
    { key: "2026-04", label: "abril/2026", colBase: 25 },
    { key: "2026-05", label: "maio/2026", colBase: 29 },
    { key: "2026-06", label: "junho/2026", colBase: 33 },
    { key: "2026-07", label: "julho/2026", colBase: 37 },
    { key: "2026-08", label: "agosto/2026", colBase: 41 },
    { key: "2026-09", label: "setembro/2026", colBase: 45 },
    { key: "2026-10", label: "outubro/2026", colBase: 49 },
    { key: "2026-11", label: "novembro/2026", colBase: 53 },
    { key: "2026-12", label: "dezembro/2026", colBase: 57 },
    { key: "2027-01", label: "janeiro/2027", colBase: 61 },
  ];

  // Linhas (1-based, igual à planilha) que são cabeçalhos ou subtotais já
  // calculados pela própria planilha — devem ser ignoradas ao ler transações.
  const EXCLUDED_ROWS = new Set([
    39, 42, 48, 56, 57, 58, 60, 63, 80, 101, 102, 116, 129, 130, 131, 132,
    135, 136, 137, 159, 160, 161, 162, 163, 164, 165, 166, 167, 182, 183,
    184, 187, 192, 193, 194,
  ]);
  // Linha 192 ("Salário VorpTech - Pagamento 5º dia") duplica o que já está
  // detalhado nas linhas 188-191 (Salário Líquido + Vale Refeição + Vale
  // Transporte + Pagamentos Extras) — confirmado comparando com o total da
  // própria planilha (linha 193), que bate com a soma de 188-191, não com 192.

  // Faixas de linha por tipo de bloco.
  const INCOME_RANGES = [[40, 58], [187, 193]];
  const EXPENSE_CORE_RANGES = [[61, 133], [195, 210]];
  const EXPENSE_CARD_RANGES = [[135, 184]];

  function inRanges(row, ranges) {
    return ranges.some(([a, b]) => row >= a && row <= b);
  }

  function cell(grid, row, col) {
    const r = grid[row - 1];
    if (!r) return "";
    const v = r[col - 1];
    return v === undefined ? "" : v;
  }

  function cleanLabel(s) {
    if (typeof s !== "string") return s;
    return s
      .replace(/^[\p{Extended_Pictographic}\s]+|[\p{Extended_Pictographic}\s]+$/gu, "")
      .replace(/!+$/, "")
      .trim();
  }

  function parseDate(raw) {
    if (typeof raw !== "string") return null;
    const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  }

  function parseTransactionsFromRow(grid, row) {
    const bRaw = cell(grid, row, 2);
    const cRaw = cell(grid, row, 3);
    const categoria = typeof bRaw === "string" ? cleanLabel(bRaw) : "";
    const contagem = typeof cRaw === "string" ? cleanLabel(cRaw) : "";

    const isIncome = inRanges(row, INCOME_RANGES);
    const isCore = inRanges(row, EXPENSE_CORE_RANGES);
    const isCard = inRanges(row, EXPENSE_CARD_RANGES);
    if (!isIncome && !isCore && !isCard) return [];

    const type = isIncome ? "income" : "expense";
    const isCardDetail = isCard;

    const out = [];
    for (const month of MONTHS) {
      const quando = cell(grid, row, month.colBase);
      const quanto = cell(grid, row, month.colBase + 1);
      const pago = cell(grid, row, month.colBase + 2);

      if (typeof quanto !== "number") continue;
      const paid = typeof pago === "string" && pago.includes("✅");
      const note = typeof pago === "string" ? pago.replace(/✅/g, "").trim() : "";
      if (quanto === 0 && !paid && !note) continue;

      out.push({
        row,
        month: month.key,
        monthLabel: month.label,
        type,
        isCardDetail,
        categoria: categoria || (type === "income" ? "Renda" : "Outros"),
        descricao: contagem || note || categoria || "(sem descrição)",
        date: parseDate(quando),
        amount: quanto,
        paid,
        note,
      });
    }
    return out;
  }

  function parse(grid) {
    const transactions = [];
    const maxRow = grid.length;
    for (let row = 1; row <= maxRow; row++) {
      if (EXCLUDED_ROWS.has(row)) continue;
      transactions.push(...parseTransactionsFromRow(grid, row));
    }
    return { months: MONTHS, transactions };
  }

  return { parse, MONTHS };
})();
