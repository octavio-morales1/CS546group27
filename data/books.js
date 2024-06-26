import axios from 'axios'; 
import * as mongoCollections from '../config/mongoCollections.js';
const bookCollection = await mongoCollections.books();
const RESULTS_PER_PAGE = 5;

const addReview = async (bookId, userId, rating, comment) => {
    const newReview = {
        userId,
        rating,
        comment,
        date: new Date()
    };

    const updateResult = await bookCollection.updateOne(
        { _id: bookId },
        { $push: { reviews: newReview } }
    );

    return updateResult.modifiedCount > 0;
};


const CONCATNATE_NAMES = (authors) => {
    let names = authors.map(author => author.name);
    return names.join(', ');
}

const CLEAN = (paragraph) => {
    if (!paragraph) return ''; 
    return paragraph
      .replace(/\[.*?\]|\(.*?\)|\{.*?\}|https?:\/\/(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g, '')
      .replace(/[-\r\n|\r|\n]|:/g, '')
      .replace(/\*\*Contains\*\*.*?/g, '');
};

function PAGE_SECTION(page) {
    let increment = 25 * ((page - 1) % 4 + 1);
    let page_number = Math.floor((page - 1) / 4) + 1;
    
    return {
        section: increment,
        page: page_number
    }
}

const GET_AUTHOR_DATA = async(key) => {
    if (typeof key !== 'string' || key.trim().length === 0) throw 'Invalid author key';
    try {
        const response = await axios.get(`https://openlibrary.org${key}.json`);
        const author = response.data
        return {author_key: key, name : author.name, img: author.photos? author.photos[0] : null}
    } catch (error){
        throw error ? error : `Failed to retrieve book data ${key}`
    }
} 

const ITERATE_THROUGH_AUTHORS = async (authors) => {
    if (!authors) return [];
    try {
        const author_keys = authors.flatMap((author) => {
            if (author.type && author.type.key === '/type/author_role' && author.author && author.author.key) {
            return author.author.key;
            }
            return [];
        });
        const author_data = [];
        for (const key of author_keys) {
            const author = await GET_AUTHOR_DATA(key);
            author_data.push(author);
        }
        
        return author_data;
    } catch (error) {
        throw error;
    }
};

const IS_EXIST_BOOK = async(key) => {
    if (typeof key !== 'string' || key.trim().length === 0) throw 'Invalid book key';
    try {
        const response = await axios.get(`https://openlibrary.org${key}.json`);
        return response.data.error? true: false
    } catch (error){
        throw error
    }
}

const CREATE_BOOK_DATA = async(key) => {
    if (typeof key !== 'string' || key.trim().length === 0) throw 'Invalid book key';
    try {
        const response = await axios.get(`https://openlibrary.org${key}.json`);
        const book = response.data
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        const bookobj = {
            _id: key,
            title: book.title,
            author: book.authors ? CONCATNATE_NAMES(await ITERATE_THROUGH_AUTHORS(book.authors)) : "",
            publishedDate: book.created ? new Date(book.created.value).toLocaleDateString('en-US', options) : null,
            synopsis: book.description ? CLEAN(book.description.text) : null,
            ratings: [],
            reviews: [],
            genre: book.subject? book.subject : [],
            img: book.covers ? `https://covers.openlibrary.org/b/id/${book.covers[0]}-M.jpg`: null
        }
        const newInsertInformation = await bookCollection.insertOne(bookobj);
        if (!newInsertInformation.insertedId) throw 'Error: Insert failed!';
        return bookobj

    } catch (error){
        throw error ? error : `Failled to retrieve book data ${key}`
    }
}


const BOOK_SEARCH_BY_KEY = async(key) => {
    if (!key || typeof key !== 'string' || key.trim() === "") throw 'Error: id does not exist or is not a valid string'
    let book = await bookCollection.findOne({ _id: key });
    if (book === null) {
        book = await CREATE_BOOK_DATA(key)
    }
    return book
}

const BOOK_SEARCH = async (title, site_page = 0) => {
    if (typeof title !== 'string' || title.trim().length === 0) return 'Error: Invalid title';
    if (typeof site_page !== 'number' || site_page < 0) return 'Error: Invalid page number';
  
    const encodedTitle = encodeURIComponent(title.trim());
    const url = `https://openlibrary.org/search.json?q=${encodedTitle}&offset=${site_page * RESULTS_PER_PAGE}&limit=${RESULTS_PER_PAGE}`;
  
    const response = await axios.get(url);
    const books = response.data['docs'] || [];
  
    const books_keys = books.map(book => book.key);
    const bookDetailsPromises = books_keys.map(key => BOOK_SEARCH_BY_KEY(key));
  
    try {
      const bookDetails = await Promise.all(bookDetailsPromises);
      return bookDetails;
    } catch (error) {
      throw `Failed to fetch data: ${error}`;
    }
  };

export { addReview, BOOK_SEARCH, BOOK_SEARCH_BY_KEY, CREATE_BOOK_DATA, IS_EXIST_BOOK };
