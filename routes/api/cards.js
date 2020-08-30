const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const { check, validationResult } = require('express-validator');

const User = require('../../models/User');
const Board = require('../../models/Board');
const List = require('../../models/List');
const Card = require('../../models/Card');

// Add a card
router.post(
  '/',
  [auth, [check('title', 'Title is required').not().isEmpty()]],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { title, listId, boardId } = req.body;

      // Create and save the card
      const newCard = new Card({ title });
      const card = await newCard.save();

      // Assign the card to the list
      const list = await List.findById(listId);
      list.cards.push(card.id);
      await list.save();

      // Log activity
      const user = await User.findById(req.user.id);
      const board = await Board.findById(boardId);
      board.activity.unshift({
        text: `${user.name} added ${title} to ${list.title}`,
      });
      await board.save();

      res.json(card);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

// Get all of a list's cards
router.get('/listCards/:listId', auth, async (req, res) => {
  try {
    const list = await List.findById(req.params.listId);
    if (!list) {
      return res.status(404).json({ msg: 'List not found' });
    }

    res.json(list.cards);
  } catch (error) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Get a card by id
router.get('/:id', auth, async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) {
      return res.status(404).json({ msg: 'Card not found' });
    }

    res.json(card);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Edit a card's title and/or description
router.patch('/:id', auth, async (req, res) => {
  try {
    const { title, description } = req.body;
    if (title === '') {
      return res.status(400).json({ msg: 'Title is required' });
    }

    const card = await Card.findById(req.params.id);
    if (!card) {
      return res.status(404).json({ msg: 'Card not found' });
    }

    card.title = title ? title : card.title;
    card.description = description ? description : card.description;
    await card.save();

    res.json(card);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Archive/Unarchive a card
router.patch('/archive/:archive/:id', auth, async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) {
      return res.status(404).json({ msg: 'Card not found' });
    }

    card.archived = req.params.archive === 'true';
    await card.save();

    // Log activity
    const user = await User.findById(req.user.id);
    const board = await Board.findById(req.body.boardId);
    board.activity.unshift({
      text: card.archived
        ? `${user.name} archived card ${card.title}`
        : `${user.name} sent card ${card.title} to the board`,
    });
    await board.save();

    res.json(card);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Move a card
router.patch('/move/:cardId', auth, async (req, res) => {
  try {
    const cardId = req.params.cardId;
    const from = await List.findById(req.body.from);
    const to = await List.findById(req.body.to);
    if (!cardId || !from || !to) {
      return res.status(404).json({ msg: 'List/card not found' });
    }

    const cardIndex = from.cards.indexOf(cardId);
    if (cardIndex !== -1) {
      from.cards.splice(cardIndex, 1);
      await from.save();
    }

    if (!to.cards.includes(cardId)) {
      to.cards.push(cardId);
      await to.save();
    }

    // Log activity
    const user = await User.findById(req.user.id);
    const board = await Board.findById(req.body.boardId);
    const card = await Card.findById(cardId);
    board.activity.unshift({
      text: `${user.name} moved ${card.title} from ${from.title} to ${to.title}`,
    });
    await board.save();

    res.send({ from, to });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Delete a card
router.delete('/:id', auth, async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    const list = await List.findById(req.body.listId);
    if (!card || !list) {
      return res.status(404).json({ msg: 'List/card not found' });
    }

    list.cards.splice(list.cards.indexOf(req.params.id), 1);
    await list.save();
    await card.remove();

    // Log activity
    const user = await User.findById(req.user.id);
    const board = await Board.findById(req.body.boardId);
    board.activity.unshift({
      text: `${user.name} deleted ${card.title} from ${list.title}`,
    });
    await board.save();

    res.json({ msg: 'Card removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
