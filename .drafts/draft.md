Hi Andy, Katie, Rob,

I wanted to get your view on something that's come up on the witness details page (screenshot attached).

The page shows information about a witness broken into sections - personal details, contact details, statements, availability, special measures. 

Each section has an h2 heading followed by a summary list. A boring/standard GOV.UK pattern.

A developer has suggested each h2 + summary list is wrapped in a `<section>` element to provide landmarks.

But I don't think this is necessary or useful and potentially will degrade UX. 

A `<section>` element on its own doesn't create a landmark - it only becomes a region landmark if you give it an accessible name using `aria-label` or `aria-labelledby`. If we added `aria-labelledby` pointing to the h2 heading that’s already there, it would just be duplicating what the heading already provides. Screen reader users can already navigate by headings using the H key, which is a common way to traverse the page.

The other concern is that this page could end up with five or more region landmarks, which actually makes landmark navigation less useful. Landmarks work best when there's a small number of them for key areas like main content, navigation, and search - not when every block of content is wrapped in one.

I double-checked my thinking with in x-gov Slack with some GDS folks (and other departments) and they agreed. I also want to highlight that the GOV.UK Design System doesn't use `<section>` wrappers for this pattern either, for example on their check answers pattern.

What do you think?

Adam

Additional references:

- https://design-system.service.gov.uk/patterns/check-answers/default/
- https://insidegovuk.blog.gov.uk/2013/07/03/rethinking-navigation/
- https://www.smashingmagazine.com/2020/01/html5-article-section/ 
