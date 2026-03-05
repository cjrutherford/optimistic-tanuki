# Accessibility & Error Handling

The Client Interface is built with accessibility in mind and includes robust error handling for a smooth user experience.

## Accessibility Features

### ARIA Support

- Proper ARIA labels on interactive elements
- Live regions for dynamic content
- Role attributes for custom components
- Form field associations

### Keyboard Navigation

- Full keyboard navigation support
- Arrow key navigation in lists
- Tab navigation between elements
- Enter/Space to activate

### Focus Management

- Focus trap in modals/dialogs
- Visible focus indicators
- Skip links for keyboard users
- Focus restoration after actions

### Screen Reader Support

- Semantic HTML structure
- Hidden text alternatives
- Proper heading hierarchy
- Descriptive link text

## Components

| Component            | Description              |
| -------------------- | ------------------------ |
| KeyboardNavDirective | Arrow key navigation     |
| FocusTrapDirective   | Focus trapping in modals |
| A11yService          | Accessibility utilities  |

## CSS Utilities

```scss
// Screen reader only (visible to screen readers)
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

// Skip link
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  // ... styles
}
```

## Error Handling

### HTTP Error Interceptor

All HTTP errors are intercepted and handled:

- User-friendly error messages
- Status code-specific handling
- Automatic retry for temporary failures

### Error Messages by Status

| Status      | Message                       |
| ----------- | ----------------------------- |
| 0 (Network) | Unable to connect to server   |
| 400         | Invalid request               |
| 401         | Session expired, please login |
| 403         | Permission denied             |
| 404         | Resource not found            |
| 422         | Validation error              |
| 429         | Too many requests             |
| 500         | Server error                  |
| 502/503/504 | Service unavailable           |

### Global Error Handler

Unhandled errors are caught by the global error handler:

- User-friendly messages
- Console logging for debugging
- Error reporting for monitoring

### Toast Notifications

Errors are displayed as toast notifications using the MessageService:

- Error (red): Critical issues
- Warning (yellow): Recoverable issues
- Info (blue): Informational messages
- Success (green): Operation successful

## Services

| Service        | Description             |
| -------------- | ----------------------- |
| A11yService    | Accessibility utilities |
| MessageService | Toast notifications     |

## Best Practices

1. Always provide fallbacks for dynamic content
2. Use semantic HTML elements
3. Test with screen readers
4. Maintain visible focus indicators
5. Provide clear error messages
6. Log errors for debugging
