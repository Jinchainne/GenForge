import type {
  ManualVerificationItem,
  MissingInformationItem,
} from "@genforge/domain";

type ListItem = MissingInformationItem | ManualVerificationItem;

export function ListPanel({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: ListItem[];
  emptyMessage: string;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3>{title}</h3>
        <span>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="subtle">{emptyMessage}</p>
      ) : (
        <ul className="stack-list">
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.summary}</strong>
              <p>{"reason" in item ? item.reason : item.rationale}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
