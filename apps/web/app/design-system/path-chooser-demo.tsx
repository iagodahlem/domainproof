'use client'

import { useState } from 'react'
import { PathChooser } from '@domainproof/ui'

function ApiIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m18 16 4-4-4-4M6 8l-4 4 4 4M14.5 4l-5 16" />
    </svg>
  )
}

function HostedIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.5-1.5" />
    </svg>
  )
}

function ComponentsIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" />
      <path d="M12 12v9M3 7l9 5 9-5" />
    </svg>
  )
}

function AgentsIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
    </svg>
  )
}

const OPTIONS = [
  { id: 'api', icon: <ApiIcon />, label: 'API', sub: 'Full control, your UI' },
  {
    id: 'hosted',
    icon: <HostedIcon />,
    label: 'Hosted page',
    sub: 'We host the UI',
  },
  {
    id: 'components',
    icon: <ComponentsIcon />,
    label: 'React components',
    sub: 'Drop into your app',
  },
  {
    id: 'agents',
    icon: <AgentsIcon />,
    label: 'Agents & CLI',
    sub: 'Hand it off',
  },
]

export function PathChooserDemo() {
  const [value, setValue] = useState('api')
  return (
    <PathChooser
      options={OPTIONS}
      value={value}
      onChange={setValue}
      className="mb-0 w-full"
      aria-label="Integration path"
    />
  )
}
