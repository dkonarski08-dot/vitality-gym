// app/(dashboard)/hall/components/ConfigTab.tsx
import { HallClass } from '../types'

interface Props {
  classes: HallClass[]
}

export function ConfigTab({ classes }: Props) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-6">Настройки на класовете</h2>
      <div className="space-y-3">
        {classes.map(cls => (
          <div key={cls.id} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-medium text-white">{cls.name}</div>
              <div className="text-xs text-white/40">{cls.duration_minutes} мин • Макс. {cls.max_capacity} души</div>
            </div>
            <div className="grid grid-cols-6 gap-3 text-xs">
              {[
                { label: 'В брой (€)', field: 'price_cash', value: cls.price_cash },
                { label: 'Абонамент (€)', field: 'price_subscription', value: cls.price_subscription },
                { label: 'Мултиспорт (€)', field: 'price_multisport', value: cls.price_multisport },
                { label: 'Куулфит (€)', field: 'price_coolfit', value: cls.price_coolfit },
                { label: '% Инструктор', field: 'instructor_percent', value: cls.instructor_percent },
                { label: 'Капацитет', field: 'max_capacity', value: cls.max_capacity },
              ].map(f => (
                <div key={f.field}>
                  <div className="text-white/50 mb-1">{f.label}</div>
                  <input
                    type="number"
                    defaultValue={f.value}
                    onBlur={async e => {
                      const val = parseFloat(e.target.value)
                      if (!isNaN(val)) {
                        await fetch('/api/hall/classes', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: cls.id, field: f.field, value: val }),
                        })
                      }
                    }}
                    className="bg-white/5 border border-white/15 rounded px-2 py-1.5 text-white w-full focus:border-violet-400 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        {classes.length === 0 && <div className="text-center text-white/30 py-10">Първо импортирай GymRealm файл.</div>}
      </div>
    </div>
  )
}
