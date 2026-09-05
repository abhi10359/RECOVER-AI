/**
 * Utility to format and download an array of objects as a CSV file.
 * Automatically handles escaping, commas, quotes, nested objects, and formatting.
 *
 * @param {Array<Object>} data - The dataset to export.
 * @param {string} filename - Target filename (e.g. 'failed_transactions.csv').
 * @param {Array<{ key: string, label: string, formatter?: (val: any, row: Object) => string }>} customColumns - Optional custom column mappings.
 */
export function exportToCSV(data, filename = "export.csv", customColumns = null) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.warn("No data available to export as CSV.");
    return false;
  }

  try {
    let headers = [];
    let headerLabels = [];

    if (customColumns && customColumns.length > 0) {
      headers = customColumns.map((col) => col.key);
      headerLabels = customColumns.map((col) => col.label || col.key);
    } else {
      headers = Object.keys(data[0]);
      headerLabels = headers.map((h) =>
        h
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
      );
    }

    const rows = [];
    // Add header row
    rows.push(
      headerLabels
        .map((label) => `"${String(label).replace(/"/g, '""')}"`)
        .join(",")
    );

    // Add data rows
    data.forEach((item) => {
      const rowValues = headers.map((key, idx) => {
        let val;
        if (customColumns && customColumns[idx]?.formatter) {
          val = customColumns[idx].formatter(item[key], item);
        } else {
          val = item[key];
        }

        if (val === null || val === undefined) {
          return '""';
        }
        if (typeof val === "object") {
          return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        }
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      rows.push(rowValues.join(","));
    });

    const csvContent = "\uFEFF" + rows.join("\r\n"); // UTF-8 BOM for Excel compatibility
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.setAttribute("href", url);
    link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error("Failed to export CSV:", error);
    return false;
  }
}
