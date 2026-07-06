import { useState } from "react";

/** Sort state for table headers: click toggles direction, new column resets to desc. */
export function useSortState(defaultKey, defaultDir = "desc") {
  const [sort, setSort] = useState({ key: defaultKey, dir: defaultDir });
  const onSort = (k) =>
    setSort((s) =>
      s.key === k ? { key: k, dir: s.dir === "asc" ? "desc" : "asc" } : { key: k, dir: "desc" }
    );
  return [sort, onSort];
}
