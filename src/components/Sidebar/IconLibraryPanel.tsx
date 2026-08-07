import { LOGISTICS_ICONS, ICON_CATEGORY_LABELS, type IconCategory } from '../../lib/icons/logisticsIcons';
import { useLabelStore, createDefaultIcon } from '../../state/useLabelStore';

const CATEGORIES: IconCategory[] = ['handling', 'recycling'];

export default function IconLibraryPanel() {
  const { addElement } = useLabelStore();
  return (
    <div className="p-3 flex flex-col gap-4">
      {CATEGORIES.map((cat) => (
        <div key={cat}>
          <h3 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
            {ICON_CATEGORY_LABELS[cat]}
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {LOGISTICS_ICONS.filter((icon) => icon.category === cat).map((icon) => (
              <button
                key={icon.id}
                title={icon.name}
                onClick={() => addElement(createDefaultIcon(10, 10, icon.id))}
                className="bg-white rounded p-2 hover:ring-2 hover:ring-indigo-400 transition-shadow flex items-center justify-center aspect-square"
              >
                <div className="w-full h-full" dangerouslySetInnerHTML={{ __html: icon.svg }} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
