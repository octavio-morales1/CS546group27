import { Router } from "express";

import * as userAPI from '../data/user.js'

import * as booksAPI from '../data/books.js'

import * as bookClubAPI from '../data/book_club.js'

import * as discussionAPI from '../data/discussions.js'

const checkBookClubExists = (bookClubs, targetId) => {
  for (let bookClub of bookClubs) {
      if (bookClub._id.toString() === targetId) {
          return true;
      }
  }
  return false;
}

const router = Router();


router.get('/', (req, res) => {
    // Render the registration form
    if (!req.session.user) {
      return res.redirect('/login');
    } else {
      return res.redirect(`/user/${req.session.user.username}`);
    }
});

router.get('/register', (req, res) => {
  return res.status(400).render("register");
});

router.post('/register', async (req, res) => {
  const {
    firstName, 
    lastName,
    email,
    username,
    password,
  } = req.body;

  try {
    let create = await userAPI.CREATE_USER(firstName, lastName, email, username, password);
    if (create.signupCompleted === true) {
      return res.render("login");
    } else {
      return res.status(500).send("Internal Server Error");
    }
  } catch (error) {
    return res.status(400).render("register", { error: error.toString() });
  }
});

// Login view
router.get('/login', (req, res) => {
  return res.status(400).render("login");
});

router.post('/login', async (req, res) => { 
  const {email, password } = req.body;
  try {
    let user = await userAPI.LOGIN_IN(email, password); 
    // { id, first_name, last_name, username, joined_date, book_clubs, reviews }
    req.session.user = user;
    return res.redirect(`/landing`);
  } catch(error) {
    return res.status(400).render("login", {error: 'Invalid Username or Password'});
  }
});

// User profile route
router.get('/user/:username', async(req, res) => {
  try {
    const user = await userAPI.GET_USER_BY_USERNAME(req.params.username); //supposed to have await (come back to this later)
    res.render("userinformation", { user: user });
  } catch (error) {
      res.status(500).render("error", { error: error });
  }
});

router.get('/search', async (req, res) => {
  //const key = req.params.key;
  return res.render('search', {user: req.session.user});
});

router.post('/books/search', async (req, res) => {
  const searchTerm = req.body.searchBookByName.trim();
  try {
      const books = await booksAPI.BOOK_SEARCH(searchTerm);
      res.render("searchResults", { books, user: req.session.user });
  } catch (error) {
      res.status(500).render("error", { error: "Error searching books" });
  }
});

// Display book details and reviews
router.get('/book/works/:bookId', async(req, res) => {
  try {
    const book = await booksAPI.BOOK_SEARCH_BY_KEY("/works/" + req.params.bookId); //supposed to have await (come back to this later)
    res.render("bookHomepage", {user: req.session.user, book:book, id: req.params.bookId});  // Assume you have a bookHomepage.handlebars
  } catch (error) {
    res.status(500).render("error", { error: "Book not found" });
    }
  });

router.get('/bookclubs', async (req, res) => {
  try {
      const bookClubs = req.session.user.book_clubs
      res.render('bookclubsHomepage', { bookClubs, user: req.session.user });  // Assume you have a bookclubsHomepage.handlebars
  } catch (error) {
      res.status(500).render("error", { error: "Failed to fetch book clubs" });
  }
});

router.post('/bookclubs/works/:bookId/create', async (req, res) => {
  const { clubName, description } = req.body;
  const { user } = req.session;
  
  if (!user || !user.id || typeof user.id !== 'string' || user.id.trim() === "") {
    return res.status(400).render("error", { error: "Invalid user session. Please log in." });
  }
  
  try {
    let bookClub = await bookClubAPI.CREATE_BOOK_CLUB(user.id, clubName, description, "/works/" + req.params.bookId);
    return res.redirect(`/bookclubs/${bookClub._id}`);
  } catch (error) {
    return res.status(500).render("error", { error: error });
}
});

router.get('/bookclubs/:bookClubId', async (req, res) => {
  const bookClubId = req.params.bookClubId;
  try {
    
    const book_club = await bookClubAPI.GET_BOOK_CLUB_BY_ID(bookClubId);
    req.session.user = await userAPI.GET_USER_BY_ID(req.session.user.id)
    if (!checkBookClubExists(req.session.user.book_clubs, bookClubId)){
      res.redirect(`/bookclubs/${bookClubId}/join`);
    }
    res.render('bookclub', { user: req.session.user, book_club, discussionId: book_club.discussions[0]._id, bookClubId })
  } catch (error) {
      res.status(500).render("error", { error: error });
  }
});

router.get('/bookclubs/:bookClubId/join', async (req, res) => {
  const bookClubId = req.params.bookClubId;
  try {
    if (checkBookClubExists(req.session.user.book_clubs, bookClubId)){
      res.redirect(`/bookclubs/${bookClub._id}`);
    }
    res.render('join')
  } catch (error) {
      res.status(500).render("error", { error: error });
  }
});

router.post('/bookclubs/:bookClubId/join', async (req, res) => {
  try {
    if (checkBookClubExists(req.session.user.book_clubs, req.params.bookClubId)){
      res.redirect(`/bookclubs/${bookClub._id}`);
    }

    await bookClubAPI.JOIN_BOOK_CLUB(req.session.user.id, req.params.bookClubId)
    res.redirect(`/bookclubs/${bookClub._id}`);
  } catch (error) {
    res.status(500).render("error", { error: error });
  }
});

router.post('/comment', async (req, res) => {
  const { discussionId, threadId, comment, bookClubId } = req.body;

  try {
    const commentObj = await discussionAPI.commentThread(bookClubId, discussionId, threadId, req.session.user.id, comment);
    res.redirect(`/bookclubs/${bookClubId}`);
    
  } catch (error) {
    res.status(500).render("error", { error: error });
  }
});

// const thread = {
//   _id: new ObjectId(),
//   createdBy: userId,
//   content,
//   comments: [],
//   createdAt: new Date()
// };

router.post('/thread', async (req, res) => {
  const { discussionId, content, bookClubId } = req.body;

  try {
    await discussionAPI.createThread(bookClubId, discussionId, req.session.user.id, content);
    res.redirect(`/bookclubs/${bookClubId}`);
  } catch (error) {
    res.redirect(`/bookclubs/${bookClubId}`);
  }
});

router.get('/landing', async (req, res) => {
  try {
      const bookClubs= await bookClubAPI.getFeaturedBookClubs();
      const discussions= await discussionAPI.getPopularDiscussions();

      res.render('landingpage', {
          user: req.session.user,
          bookClubs: bookClubs,
          discussions: discussions,
      });
  } catch (error) {
      res.status(500).render("error", { error: error.toString() });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  return res.render("logout", {title: "Log Out"});

});


export default router;

