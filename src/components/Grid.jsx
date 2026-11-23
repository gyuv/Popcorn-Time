import Card from './Card.jsx';
import { useFiltered } from './Row.jsx';
export default function Grid({ items }) {
  const list = useFiltered(items);
  return <div className="grid">{list.map(i => <Card key={`${i.type}${i.id}`} item={i} />)}</div>;
}
