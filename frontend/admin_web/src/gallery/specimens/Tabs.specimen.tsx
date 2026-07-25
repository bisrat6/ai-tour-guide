import { useState, type ReactElement } from 'react'

import { TabPanel, Tabs, TabsLoadingStrip } from '../../kit/Tabs/index.ts'
import type { StateFilter } from '../GalleryNav.tsx'
import { SpecimenStack } from './SpecimenStack.tsx'
import styles from '../Gallery.module.css'

const TAB_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'activity', label: 'Activity', count: 7 },
  { id: 'narration', label: 'Narration', disabled: true, disabledReason: 'Available when voice provider is connected.' },
] as const

const NA_NOTES = [
  {
    state: 'empty' as const,
    reason: 'Does not apply: a tablist with no tabs is not rendered.',
  },
  {
    state: 'failure' as const,
    reason: 'Does not apply at strip level; panel content owns failure.',
  },
  {
    state: 'unauthorized' as const,
    reason: 'Does not apply: tabs a role cannot see are absent from items.',
  },
] as const

export function TabsSpecimen({ stateFilter }: { readonly stateFilter: StateFilter }): ReactElement {
  const [activeId, setActiveId] = useState('overview')
  const [manualActiveId, setManualActiveId] = useState('overview')

  return (
    <SpecimenStack stateFilter={stateFilter} notes={[...NA_NOTES]}>
      {(state) => {
        if (state === 'ready') {
          return (
            <div className={styles.tabsStack}>
              <Tabs
                label="Room details"
                items={[...TAB_ITEMS]}
                activeId={activeId}
                onChange={setActiveId}
                idPrefix="tabs-underline"
              >
                <TabPanel tabId="overview" idPrefix="tabs-underline" active={activeId === 'overview'}>
                  <p className="text-body">Overview panel content.</p>
                </TabPanel>
                <TabPanel tabId="activity" idPrefix="tabs-underline" active={activeId === 'activity'}>
                  <p className="text-body">Activity panel content.</p>
                </TabPanel>
              </Tabs>

              <Tabs
                label="Room details — manual activation"
                items={[...TAB_ITEMS]}
                activeId={manualActiveId}
                onChange={setManualActiveId}
                activation="manual"
                variant="enclosed"
                idPrefix="tabs-enclosed"
              >
                <TabPanel tabId="overview" idPrefix="tabs-enclosed" active={manualActiveId === 'overview'}>
                  <p className="text-body">Manual activation panel.</p>
                </TabPanel>
                <TabPanel tabId="activity" idPrefix="tabs-enclosed" active={manualActiveId === 'activity'}>
                  <p className="text-body">Arrow moves focus; Enter commits.</p>
                </TabPanel>
              </Tabs>
            </div>
          )
        }

        if (state === 'loading') {
          return <TabsLoadingStrip />
        }

        if (state === 'integrationPending') {
          return (
            <Tabs
              label="Room details"
              items={[...TAB_ITEMS]}
              activeId="overview"
              onChange={() => undefined}
              idPrefix="tabs-pending"
            >
              <TabPanel tabId="overview" idPrefix="tabs-pending" active>
                <p className="text-body">Overview still works while narration is pending.</p>
              </TabPanel>
            </Tabs>
          )
        }

        return null
      }}
    </SpecimenStack>
  )
}
