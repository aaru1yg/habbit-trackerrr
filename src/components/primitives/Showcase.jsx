/* ============================================================
   PRIMITIVE SHOWCASE — DEV ONLY (Step 1B visual proof)
   Not reachable from production builds. Loaded lazily and only
   when explicitly routed to in dev.
   ============================================================ */
import { useState } from 'react'
import {
  Surface, Button, IconButton, Text, Stack, Row, Cluster, Divider,
  Badge, Status, Progress, Metric, Loading, EmptyState, Callout,
} from './index.js'
import {
  IconPlus, IconCheck, IconSettings, IconTrash, IconSparkle, IconSearch, IconChevronRight,
} from '../../lib/icons.jsx'

function Section({ title, children }) {
  return (
    <section className="p-showcase__section">
      <Text level="h2">{title}</Text>
      {children}
    </section>
  )
}

export default function PrimitiveShowcase() {
  const [theme, setTheme] = useState('midnight')
  const [progress, setProgress] = useState(42)
  const setT = (t) => { document.documentElement.setAttribute('data-theme', t); setTheme(t) }

  return (
    <div className="p p-showcase">
      <Surface variant="raised" flush>
        <Stack gap="comfortable" style={{ padding: 'var(--space-comfortable)' }}>
          <Stack gap="micro">
            <Text level="micro">Step 1B</Text>
            <Text level="display">Habit OS primitives</Text>
            <Text level="body" style={{ color: 'var(--text-secondary)' }}>
              A small, token-driven set of primitives. Both Midnight and Daylight themes shown.
            </Text>
          </Stack>
          <Cluster>
            {['midnight', 'daylight'].map((t) => (
              <Button key={t} variant={theme === t ? 'primary' : 'secondary'} size="sm" onClick={() => setT(t)}>{t}</Button>
            ))}
          </Cluster>
        </Stack>
      </Surface>

      <Section title="Surface">
        <div className="p-showcase__grid">
          <Surface variant="raised"><Text level="label">raised</Text><Text level="caption">default elevated container</Text></Surface>
          <Surface variant="inset"><Text level="label">inset</Text><Text level="caption">fields / sunken areas</Text></Surface>
          <Surface variant="interactive"><Text level="label">interactive</Text><Text level="caption">hover/active chip/row</Text></Surface>
          <Surface variant="selected"><Text level="label">selected</Text><Text level="caption">current selection</Text></Surface>
        </div>
      </Section>

      <Section title="Button">
        <Cluster>
          <Button variant="primary" icon={<IconPlus size={16}/>}>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="quiet">Quiet</Button>
          <Button variant="danger" icon={<IconTrash size={16}/>}>Danger</Button>
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="secondary" size="sm" trailing={<IconChevronRight size={14}/>}>Trailing</Button>
          <Button variant="primary" loading>Loading</Button>
          <Button variant="secondary" disabled>Disabled</Button>
          <Button variant="primary" block style={{ maxWidth: 280 }}>Block</Button>
        </Cluster>
      </Section>

      <Section title="IconButton">
        <Cluster>
          <IconButton label="Add" icon={<IconPlus size={18}/>} />
          <IconButton label="Check" icon={<IconCheck size={18}/>} />
          <IconButton label="Settings" icon={<IconSettings size={18}/>} />
          <IconButton label="Search" icon={<IconSearch size={18}/>} size="sm" />
          <IconButton label="Disabled" icon={<IconSparkle size={18}/>} disabled />
          <IconButton label="Active" icon={<IconCheck size={18}/>} active />
        </Cluster>
      </Section>

      <Section title="Typography">
        <Stack gap="compact">
          <Text level="display">Display — a calm control room</Text>
          <Text level="h1">Heading 1 — Today</Text>
          <Text level="h2">Heading 2 — This week</Text>
          <Text level="h3">Heading 3 — Patterns</Text>
          <Text level="body-lg">Large body text for lead explanations and today's headline.</Text>
          <Text level="body">Body copy wraps naturally. Tabular numbers 0123456789 stay aligned.</Text>
          <Text level="label">Label — 400 days</Text>
          <Text level="caption">Caption · smaller secondary metadata</Text>
          <Text level="micro">micro · uppercase labels</Text>
          <Text level="metric">87%</Text>
        </Stack>
      </Section>

      <Section title="Stack / Row / Cluster">
        <Row gap="comfortable" align="between">
          <Stack gap="compact">
            <Text level="label">Stack (vertical)</Text>
            <Badge tone="success">done</Badge>
            <Badge tone="warning">pending</Badge>
            <Badge tone="info">note</Badge>
          </Stack>
          <Stack gap="compact">
            <Text level="label">Cluster</Text>
            <Cluster>
              <Badge>One</Badge><Badge tone="accent">Two</Badge><Badge tone="danger">Three</Badge><Badge tone="success">Four</Badge><Badge tone="warning">Five</Badge>
            </Cluster>
          </Stack>
        </Row>
      </Section>

      <Section title="Divider">
        <Stack gap="compact">
          <Text level="body">Above</Text>
          <Divider />
          <Text level="body">Below</Text>
        </Stack>
      </Section>

      <Section title="Badge & Status">
        <Cluster>
          <Badge>Neutral</Badge>
          <Badge tone="success">Success</Badge>
          <Badge tone="warning">Warning</Badge>
          <Badge tone="danger">Danger</Badge>
          <Badge tone="info">Info</Badge>
          <Badge tone="accent">Accent</Badge>
        </Cluster>
        <Cluster>
          <Status>Neutral</Status>
          <Status tone="success">On track</Status>
          <Status tone="warning">Needs attention</Status>
          <Status tone="danger">At risk</Status>
          <Status tone="info">Updated</Status>
        </Cluster>
      </Section>

      <Section title="Progress">
        <Stack gap="comfortable" style={{ maxWidth: 480 }}>
          <div>
            <Row align="between" gap="compact"><Text level="caption">Accent</Text><Text level="caption">{progress}%</Text></Row>
            <Progress value={progress} label="demo progress" />
          </div>
          <div>
            <Text level="caption">Success</Text>
            <Progress value={78} tone="success" />
          </div>
          <div>
            <Text level="caption">Warning</Text>
            <Progress value={45} tone="warning" />
          </div>
          <div>
            <Text level="caption">Danger</Text>
            <Progress value={22} tone="danger" />
          </div>
          <div>
            <Text level="caption">Indeterminate</Text>
            <Progress indeterminate label="loading" />
          </div>
          <Cluster>
            <Button size="sm" variant="secondary" onClick={() => setProgress((p) => Math.max(0, p - 10))}>-10</Button>
            <Button size="sm" variant="secondary" onClick={() => setProgress((p) => Math.min(100, p + 10))}>+10</Button>
          </Cluster>
        </Stack>
      </Section>

      <Section title="Metric">
        <Row gap="section" wrap>
          <Metric value="87%" label="30-day" context="+4% vs last week" />
          <Metric value="12" label="Open goals" context="2 at risk" />
          <Metric value="42m" label="Focus today" />
        </Row>
      </Section>

      <Section title="Loading">
        <Stack gap="compact" style={{ maxWidth: 420 }}>
          <Row gap="compact"><Loading variant="spinner" /><Text level="caption">Spinner (md)</Text></Row>
          <Loading variant="skeleton" shape="heading" />
          <Loading variant="skeleton" shape="text" />
          <Loading variant="skeleton" shape="text" width="70%" />
          <Row gap="compact">
            <Loading variant="skeleton" shape="circle" width={40} height={40} />
            <Stack gap="micro" style={{ flex: 1 }}>
              <Loading variant="skeleton" shape="heading" />
              <Loading variant="skeleton" shape="text" width="60%" />
            </Stack>
          </Row>
        </Stack>
      </Section>

      <Section title="EmptyState">
        <Surface variant="raised">
          <EmptyState
            icon={<IconSparkle size={20}/>}
            title="Nothing here yet"
            action={<Button variant="primary" icon={<IconPlus size={16}/>}>Add your first</Button>}
            secondary={<Button variant="quiet">Learn more</Button>}
          >
            Habits and goals appear here once you create them. Every metric comes from real data.
          </EmptyState>
        </Surface>
      </Section>

      <Section title="Callout (inline feedback)">
        <Stack gap="compact" style={{ maxWidth: 560 }}>
          <Callout tone="info" title="Synced">Your data is saved locally and synced when you're online.</Callout>
          <Callout tone="success" title="All done">Everything scheduled for today is complete.</Callout>
          <Callout tone="warning" title="Over capacity">Tomorrow is committed 30 minutes over your daily limit.</Callout>
          <Callout tone="danger" title="Project at risk">Deadline is tomorrow and progress is 30% behind pace.</Callout>
        </Stack>
      </Section>

      <Section title="Focus">
        <Text level="caption">Tab through buttons above; focus ring should be visible on keyboard focus only.</Text>
      </Section>
    </div>
  )
}
